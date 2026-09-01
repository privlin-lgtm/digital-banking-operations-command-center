import type { UserRole } from '@bankops/shared';
import type { DemoIntensity, DemoModeState, DemoScenario } from '@prisma/client';
import type { Logger } from 'pino';
import { NotFoundError } from '../../lib/errors.js';
import type { AuditLogger } from '../audit/audit-logger.js';
import { DEMO_SCENARIOS, DEMO_SCENARIO_DEFS, type DemoScenarioDef } from './demo-scenarios.js';
import type {
  DemoModeRepository,
  EnableDemoModeInput,
  IncidentLifecycle,
  MetricEvaluator,
  MetricRecorder,
  RcaLifecycle,
  ReviewerLookup,
  SlaRollupTrigger,
  ServiceLookup,
} from './demo-mode.types.js';

interface TickRange {
  min: number;
  max: number;
}

interface IntensityProfile {
  baseline: TickRange;
  degrading: TickRange;
  incident: TickRange;
  remediating: TickRange;
  rcaDelay: TickRange;
  cooldown: TickRange;
}

/** Fraction of a metric's (target - from) span used as +/- jitter amplitude — what keeps a run from looking like a straight line, without ever being large enough to cross a tier boundary on its own (see breachStart's margin). Fixed across intensities on purpose. */
const NOISE_FACTOR = 0.06;

/**
 * Pacing only — every mechanism (which metrics move, which alert fires,
 * whether remediation runs) is identical across intensities. LOW spreads
 * the same run over more ticks for an ambient background demo; HIGH
 * compresses it for a time-boxed interview walkthrough.
 */
const INTENSITY_PROFILES: Record<DemoIntensity, IntensityProfile> = {
  LOW: {
    baseline: { min: 3, max: 5 },
    degrading: { min: 7, max: 10 },
    incident: { min: 4, max: 6 },
    remediating: { min: 6, max: 8 },
    rcaDelay: { min: 2, max: 3 },
    cooldown: { min: 3, max: 5 },
  },
  MEDIUM: {
    baseline: { min: 2, max: 3 },
    degrading: { min: 4, max: 7 },
    incident: { min: 2, max: 4 },
    remediating: { min: 4, max: 6 },
    rcaDelay: { min: 1, max: 2 },
    cooldown: { min: 2, max: 3 },
  },
  HIGH: {
    baseline: { min: 1, max: 2 },
    degrading: { min: 3, max: 4 },
    incident: { min: 1, max: 2 },
    remediating: { min: 2, max: 3 },
    rcaDelay: { min: 1, max: 1 },
    cooldown: { min: 1, max: 2 },
  },
};

const TRIGGER_FILLERS = [
  'a batch job that held transactions open longer than usual',
  'a spike in concurrent report generation',
  'an upstream retry storm',
  'an unusually large reconciliation run',
];

const AUTO_INCIDENT_SEVERITIES = new Set(['SEV1']);

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Configurable, controlled chaos: drives one narrative archetype at a time
 * end-to-end through every real pipeline this platform already has —
 * Metric -> AlertsService.evaluateMetric -> auto-incident -> auto-
 * remediation -> IncidentsService lifecycle -> SlaTrackingService rollup ->
 * RcaService draft/review/approve. Nothing here writes an Incident, Alert,
 * SlaRecord, or RcaReport row directly; DemoModeService's own writes are
 * confined to its own singleton state row (see DemoModeRepository) plus the
 * ordinary Metric samples every real monitoring agent would also produce.
 *
 * Called once per scheduler tick (see server.ts's demo-mode-tick job,
 * advisory-locked the same way FailureSimulatorService's tick is), the same
 * "record then evaluate" shape FailureSimulatorService uses — the
 * difference is a bounded phase state machine on top, so a run reliably
 * reaches an incident, a remediation, a resolution, and a published RCA
 * instead of drifting indefinitely.
 */
export class DemoModeService {
  constructor(
    private readonly repository: DemoModeRepository,
    private readonly serviceLookup: ServiceLookup,
    private readonly metricRecorder: MetricRecorder,
    private readonly metricEvaluator: MetricEvaluator,
    private readonly incidents: IncidentLifecycle,
    private readonly sla: SlaRollupTrigger,
    private readonly rca: RcaLifecycle,
    private readonly reviewerLookup: ReviewerLookup,
    private readonly auditLogger: AuditLogger,
    private readonly logger: Logger,
    private readonly random: () => number = Math.random,
  ) {}

  getState(): Promise<DemoModeState> {
    return this.repository.get();
  }

  async enable(input: EnableDemoModeInput, actorId: string): Promise<DemoModeState> {
    const state = await this.repository.get();
    const updated = await this.beginScenario(state, actorId, {
      scenario: input.scenario,
      intensity: input.intensity ?? state.intensity,
      autoLoop: input.autoLoop ?? state.autoLoop,
    });
    await this.auditLogger.record({
      actorId,
      action: 'demo_mode.enable',
      entityType: 'Service',
      metadata: { scenario: updated.scenario, intensity: updated.intensity },
    });
    return updated;
  }

  async disable(actorId: string): Promise<DemoModeState> {
    const updated = await this.repository.update({ enabled: false, phase: 'IDLE' });
    await this.auditLogger.record({ actorId, action: 'demo_mode.disable', entityType: 'Service' });
    return updated;
  }

  /** Called once per scheduler tick for the whole platform — a single row, so no per-service fan-out is needed. */
  async tick(actorId: string, actorRole: UserRole): Promise<void> {
    const state = await this.repository.get();
    if (!state.enabled) {
      return;
    }

    switch (state.phase) {
      case 'IDLE':
        await this.handleIdle(state, actorId);
        return;
      case 'BASELINE':
        await this.handleBaseline(state, actorId, actorRole);
        return;
      case 'DEGRADING':
        await this.handleDegrading(state, actorId, actorRole);
        return;
      case 'INCIDENT':
        await this.handleIncident(state, actorId, actorRole);
        return;
      case 'REMEDIATING':
        await this.handleRemediating(state, actorId, actorRole);
        return;
      case 'RESOLVED':
        await this.handleResolved(state, actorId);
        return;
      case 'RCA_REVIEW':
        await this.handleRcaReview(state, actorId);
        return;
      case 'COOLDOWN':
        await this.handleCooldown(state, actorId);
        return;
    }
  }

  private async handleIdle(state: DemoModeState, actorId: string): Promise<void> {
    if (!state.autoLoop) {
      return;
    }
    await this.beginScenario(state, actorId, {
      intensity: state.intensity,
      autoLoop: state.autoLoop,
    });
  }

  private async handleBaseline(
    state: DemoModeState,
    actorId: string,
    actorRole: UserRole,
  ): Promise<void> {
    const def = this.defFor(state);
    await this.recordAt(def, state.serviceId!, 0, actorId, actorRole);

    const nextTicks = state.ticksInPhase + 1;
    if (nextTicks >= state.phaseTargetTicks) {
      const profile = this.profileFor(state.intensity);
      await this.repository.update({
        phase: 'DEGRADING',
        ticksInPhase: 0,
        phaseTargetTicks: this.rampScaledTicks(profile.degrading, def.ramp),
        phaseStartedAt: new Date(),
      });
      return;
    }
    await this.repository.update({ ticksInPhase: nextTicks });
  }

  private async handleDegrading(
    state: DemoModeState,
    actorId: string,
    actorRole: UserRole,
  ): Promise<void> {
    const def = this.defFor(state);
    const nextTicks = state.ticksInPhase + 1;
    const final = nextTicks >= state.phaseTargetTicks;
    const progress = final ? 1 : nextTicks / state.phaseTargetTicks;

    // The primary metric snaps from healthy straight to critical on the
    // final tick rather than climbing tier by tier — see this class's doc
    // comment on why: AlertsService only auto-creates an incident AND only
    // auto-triggers remediation on a brand-new firing transition, so a
    // value that first breaches a lower tier and climbs from there is
    // already "firing" (just getting reclassified) by the time it reaches
    // criticalThreshold, and neither mechanism fires for a reclassification.
    // Correlated/synthetic metrics have no such constraint and still ramp
    // smoothly on `progress` for a multi-signal, gradually-worsening look.
    const primaryAlert = await this.recordAt(
      def,
      state.serviceId!,
      progress,
      actorId,
      actorRole,
      1,
      final ? 1 : 0,
    );

    if (
      primaryAlert &&
      primaryAlert.incidentId &&
      AUTO_INCIDENT_SEVERITIES.has(primaryAlert.severity)
    ) {
      const profile = this.profileFor(state.intensity);
      await this.repository.update({
        phase: 'INCIDENT',
        incidentId: primaryAlert.incidentId,
        alertId: primaryAlert.id,
        ticksInPhase: 0,
        phaseTargetTicks: this.randRange(profile.incident),
        phaseStartedAt: new Date(),
      });
      await this.tryStep(
        () => this.incidents.acknowledge(primaryAlert.incidentId!, actorId),
        'acknowledge demo incident',
      );
      return;
    }

    await this.repository.update({ ticksInPhase: final ? state.ticksInPhase : nextTicks });
  }

  private async handleIncident(
    state: DemoModeState,
    actorId: string,
    actorRole: UserRole,
  ): Promise<void> {
    const def = this.defFor(state);
    // Hold near-critical with reduced jitter — a sustained outage, not still
    // ramping — but never quite touch the exact target twice in a row so the
    // sparkline still moves during the "everyone's staring at the incident
    // channel" phase.
    await this.recordAt(def, state.serviceId!, 1, actorId, actorRole, 0.3);

    const nextTicks = state.ticksInPhase + 1;
    if (nextTicks >= state.phaseTargetTicks) {
      const profile = this.profileFor(state.intensity);
      await this.repository.update({
        phase: 'REMEDIATING',
        ticksInPhase: 0,
        phaseTargetTicks: this.rampScaledTicks(profile.remediating, def.ramp),
        phaseStartedAt: new Date(),
      });
      if (state.incidentId) {
        await this.tryStep(
          () => this.incidents.mitigate(state.incidentId!, actorId),
          'mitigate demo incident',
        );
      }
      return;
    }
    await this.repository.update({ ticksInPhase: nextTicks });
  }

  private async handleRemediating(
    state: DemoModeState,
    actorId: string,
    actorRole: UserRole,
  ): Promise<void> {
    const def = this.defFor(state);
    const nextTicks = state.ticksInPhase + 1;
    const final = nextTicks >= state.phaseTargetTicks;
    const recoveryProgress = final ? 1 : nextTicks / state.phaseTargetTicks;
    // Recovery is the mirror of the degrade curve: 1 -> 0 instead of 0 -> 1.
    const primaryAlert = await this.recordAt(
      def,
      state.serviceId!,
      1 - recoveryProgress,
      actorId,
      actorRole,
    );

    const alertAutoResolved =
      primaryAlert?.state === 'RESOLVED' && primaryAlert.id === state.alertId;

    if (alertAutoResolved || final) {
      await this.repository.update({
        phase: 'RESOLVED',
        ticksInPhase: 0,
        phaseTargetTicks: 1,
        phaseStartedAt: new Date(),
      });
      return;
    }
    await this.repository.update({ ticksInPhase: nextTicks });
  }

  private async handleResolved(state: DemoModeState, actorId: string): Promise<void> {
    const def = this.defFor(state);
    if (state.incidentId) {
      const summary =
        `Automated remediation (${def.remediationAction}) engaged; ` +
        `${def.primary.metricName} returned to its normal range and the incident was resolved.`;
      await this.tryStep(
        () => this.incidents.resolve(state.incidentId!, summary, actorId),
        'resolve demo incident',
      );
      await this.tryStep(() => this.sla.runRollup(actorId), 'run SLA rollup after demo incident');
    }

    const profile = this.profileFor(state.intensity);
    await this.repository.update({
      phase: 'RCA_REVIEW',
      ticksInPhase: 0,
      phaseTargetTicks: this.randRange(profile.rcaDelay),
      phaseStartedAt: new Date(),
    });
  }

  private async handleRcaReview(state: DemoModeState, actorId: string): Promise<void> {
    const nextTicks = state.ticksInPhase + 1;
    if (nextTicks < state.phaseTargetTicks) {
      await this.repository.update({ ticksInPhase: nextTicks });
      return;
    }

    const def = this.defFor(state);
    let rcaReportId: string | null = null;
    if (state.incidentId) {
      rcaReportId = await this.tryStep(async () => {
        const report = await this.rca.create({
          incidentId: state.incidentId!,
          rootCause: this.renderTemplate(this.pickRandom(def.rootCauseTemplates)),
          rootCauseCategory: def.rootCauseCategory,
          contributingFactors: this.renderTemplate(
            this.pickRandom(def.contributingFactorTemplates),
          ),
          authoredById: actorId,
        });
        await this.rca.submitForReview(report.id, actorId);
        const reviewer = await this.reviewerLookup.findReviewerCandidate(actorId);
        if (reviewer) {
          await this.rca.approve(report.id, reviewer.id, actorId);
        } else {
          this.logger.warn(
            { incidentId: state.incidentId },
            'Demo Mode: no distinct reviewer available — RCA left IN_REVIEW',
          );
        }
        return report.id;
      }, 'draft and approve demo RCA report');
    }

    const profile = this.profileFor(state.intensity);
    await this.repository.update({
      rcaReportId,
      phase: 'COOLDOWN',
      ticksInPhase: 0,
      phaseTargetTicks: this.randRange(profile.cooldown),
      phaseStartedAt: new Date(),
    });
  }

  private async handleCooldown(state: DemoModeState, actorId: string): Promise<void> {
    const nextTicks = state.ticksInPhase + 1;
    if (nextTicks < state.phaseTargetTicks) {
      await this.repository.update({ ticksInPhase: nextTicks });
      return;
    }

    if (state.autoLoop) {
      await this.beginScenario(state, actorId, {
        intensity: state.intensity,
        autoLoop: state.autoLoop,
      });
      return;
    }
    await this.repository.update({ phase: 'IDLE', ticksInPhase: 0, phaseTargetTicks: 0 });
  }

  /**
   * Shared by enable() and every auto-loop transition: pick a scenario
   * (never the one that just ran), resolve its target service, and reset
   * every per-run field to a fresh BASELINE.
   */
  private async beginScenario(
    state: DemoModeState,
    actorId: string,
    opts: {
      scenario?: DemoScenario | undefined;
      intensity?: DemoIntensity | undefined;
      autoLoop?: boolean | undefined;
    },
  ): Promise<DemoModeState> {
    const scenario = opts.scenario ?? this.pickScenario(state.scenario ?? undefined);
    const def = DEMO_SCENARIO_DEFS[scenario];
    const service = await this.serviceLookup.findBySlug(def.serviceSlug);
    if (!service) {
      throw new NotFoundError(
        `Demo scenario "${scenario}" targets service "${def.serviceSlug}", which was not found — has the seed run?`,
      );
    }
    const intensity = opts.intensity ?? 'MEDIUM';
    const profile = this.profileFor(intensity);

    return this.repository.update({
      enabled: true,
      autoLoop: opts.autoLoop ?? true,
      intensity,
      scenario,
      lastScenario: state.scenario,
      serviceId: service.id,
      incidentId: null,
      alertId: null,
      rcaReportId: null,
      phase: 'BASELINE',
      ticksInPhase: 0,
      phaseTargetTicks: this.randRange(profile.baseline),
      phaseStartedAt: new Date(),
      startedById: actorId,
      startedAt: new Date(),
    });
  }

  /**
   * Records + evaluates the primary metric (returning its Alert, if any)
   * plus every correlated/synthetic metric. `primaryProgress`, when given,
   * overrides `progress` for the primary metric only — see handleDegrading's
   * comment on why the primary needs a step function while everything else
   * ramps smoothly on the shared `progress` fraction.
   */
  private async recordAt(
    def: DemoScenarioDef,
    serviceId: string,
    progress: number,
    actorId: string,
    actorRole: UserRole,
    noiseScale = 1,
    primaryProgress?: number,
  ) {
    const primaryValue = this.curve(
      def.primary.baseline,
      def.primary.target,
      primaryProgress ?? progress,
      def.ramp,
      noiseScale,
    );
    await this.metricRecorder.recordMetric(serviceId, {
      metricName: def.primary.metricName,
      value: primaryValue,
      unit: def.primary.unit,
    });
    const primaryAlert = await this.metricEvaluator.evaluateMetric(
      serviceId,
      def.primary.metricName,
      primaryValue,
      actorId,
      actorRole,
    );

    for (const step of def.correlated) {
      const value = this.curve(step.baseline, step.target, progress, def.ramp, noiseScale);
      await this.metricRecorder.recordMetric(serviceId, {
        metricName: step.metricName,
        value,
        unit: step.unit,
      });
      await this.metricEvaluator.evaluateMetric(
        serviceId,
        step.metricName,
        value,
        actorId,
        actorRole,
      );
    }

    // Synthetic transactions lag slightly behind the primary signal — a
    // synthetic probe only starts failing once real impact is well underway.
    const syntheticProgress = Math.min(1, Math.max(0, (progress - 0.3) / 0.7));
    for (const step of def.synthetic) {
      const value = this.curve(step.baseline, step.target, syntheticProgress, false, noiseScale);
      await this.metricRecorder.recordMetric(serviceId, {
        metricName: step.metricName,
        value,
        unit: step.unit,
      });
      await this.metricEvaluator.evaluateMetric(
        serviceId,
        step.metricName,
        value,
        actorId,
        actorRole,
      );
    }

    return primaryAlert;
  }

  private curve(
    baseline: number,
    target: number,
    progress: number,
    ramp: boolean,
    noiseScale: number,
  ): number {
    const clamped = Math.min(1, Math.max(0, progress));
    const isExtreme = clamped === 0 || clamped === 1;
    const eased = ramp ? clamped : easeInOutQuad(clamped);
    const value = lerp(baseline, target, eased);
    if (isExtreme) {
      // No noise at the guaranteed start/end points — this is what makes the
      // breach-by-the-last-tick and recover-by-the-last-tick safety nets
      // actually guaranteed rather than "usually."
      return value;
    }
    const amplitude = Math.abs(target - baseline) * NOISE_FACTOR * noiseScale;
    const noise = (this.random() - 0.5) * 2 * amplitude;
    return ramp ? value + Math.abs(noise) * 0.4 : value + noise;
  }

  private defFor(state: DemoModeState): DemoScenarioDef {
    if (!state.scenario) {
      throw new Error('Demo Mode ticked in an active phase with no scenario selected');
    }
    return DEMO_SCENARIO_DEFS[state.scenario];
  }

  private profileFor(intensity: DemoIntensity): IntensityProfile {
    return INTENSITY_PROFILES[intensity];
  }

  private rampScaledTicks(range: TickRange, ramp: boolean): number {
    const ticks = this.randRange(range);
    return ramp ? Math.round(ticks * 1.8) : ticks;
  }

  private randRange(range: TickRange): number {
    return Math.floor(this.random() * (range.max - range.min + 1)) + range.min;
  }

  private pickScenario(exclude?: DemoScenario): DemoScenario {
    const candidates = DEMO_SCENARIOS.filter((s) => s !== exclude);
    return this.pickRandom(candidates.length > 0 ? candidates : DEMO_SCENARIOS);
  }

  private pickRandom<T>(items: readonly T[]): T {
    const index = Math.floor(this.random() * items.length);
    return items[Math.min(index, items.length - 1)]!;
  }

  private renderTemplate(template: string): string {
    return template.replace('{trigger}', () => this.pickRandom(TRIGGER_FILLERS));
  }

  /** Best-effort side steps a human could have already done manually (e.g. acknowledged the incident themselves) — never lets that stall the state machine. */
  private async tryStep<T>(fn: () => Promise<T>, description: string): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.logger.warn({ err: error }, `Demo Mode: failed to ${description} — continuing anyway`);
      return null;
    }
  }
}
