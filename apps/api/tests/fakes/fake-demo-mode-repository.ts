import type { UserRole } from '@bankops/shared';
import type { Alert, DemoModeState, RcaRootCauseCategory } from '@prisma/client';
import type {
  DemoModeRepository,
  IncidentLifecycle,
  MetricEvaluator,
  MetricRecorder,
  RcaLifecycle,
  ReviewerLookup,
  ServiceLookup,
} from '../../src/modules/demo-mode/demo-mode.types.js';

export function makeDemoModeState(overrides: Partial<DemoModeState> = {}): DemoModeState {
  return {
    id: 'singleton',
    enabled: false,
    autoLoop: true,
    intensity: 'MEDIUM',
    phase: 'IDLE',
    scenario: null,
    lastScenario: null,
    serviceId: null,
    incidentId: null,
    alertId: null,
    rcaReportId: null,
    phaseStartedAt: null,
    ticksInPhase: 0,
    phaseTargetTicks: 0,
    startedById: null,
    startedAt: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

export class FakeDemoModeRepository implements DemoModeRepository {
  private state: DemoModeState = makeDemoModeState();

  seed(overrides: Partial<DemoModeState>): DemoModeState {
    this.state = makeDemoModeState(overrides);
    return this.state;
  }

  async get(): Promise<DemoModeState> {
    return this.state;
  }

  async update(patch: Partial<DemoModeState>): Promise<DemoModeState> {
    this.state = { ...this.state, ...patch, updatedAt: new Date() };
    return this.state;
  }
}

export class FakeDemoServiceLookup implements ServiceLookup {
  private readonly bySlug = new Map<string, { id: string }>();

  seed(slug: string, id: string): void {
    this.bySlug.set(slug, { id });
  }

  async findBySlug(slug: string): Promise<{ id: string } | null> {
    return this.bySlug.get(slug) ?? null;
  }
}

export class FakeDemoMetricRecorder implements MetricRecorder {
  readonly calls: Array<{ serviceId: string; metricName: string; value: number; unit: string }> =
    [];

  async recordMetric(
    serviceId: string,
    input: { metricName: string; value: number; unit: string },
  ): Promise<unknown> {
    this.calls.push({ serviceId, ...input });
    return { id: 1n };
  }
}

/** Test-controlled: set `respond` to decide what a given (metricName, value) evaluation returns. */
export class FakeDemoMetricEvaluator implements MetricEvaluator {
  readonly calls: Array<{ serviceId: string; metricName: string; value: number }> = [];
  respond: (serviceId: string, metricName: string, value: number) => Alert | null = () => null;

  async evaluateMetric(
    serviceId: string,
    metricName: string,
    value: number,
    _actorId: string,
    _actorRole: UserRole,
  ): Promise<Alert | null> {
    this.calls.push({ serviceId, metricName, value });
    return this.respond(serviceId, metricName, value);
  }
}

export class FakeDemoIncidentLifecycle implements IncidentLifecycle {
  readonly acknowledged: string[] = [];
  readonly mitigated: string[] = [];
  readonly resolved: Array<{ id: string; summary: string }> = [];
  acknowledgeShouldThrow = false;

  async acknowledge(id: string): Promise<unknown> {
    if (this.acknowledgeShouldThrow) {
      throw new Error('already acknowledged by a human');
    }
    this.acknowledged.push(id);
    return { id };
  }

  async mitigate(id: string): Promise<unknown> {
    this.mitigated.push(id);
    return { id };
  }

  async resolve(id: string, resolutionSummary: string): Promise<unknown> {
    this.resolved.push({ id, summary: resolutionSummary });
    return { id };
  }
}

export class FakeDemoSlaRollupTrigger {
  readonly calls: string[] = [];

  async runRollup(actorId: string): Promise<unknown> {
    this.calls.push(actorId);
    return null;
  }
}

export class FakeDemoRcaLifecycle implements RcaLifecycle {
  private counter = 0;
  readonly created: Array<{ incidentId: string; authoredById: string }> = [];
  readonly submitted: string[] = [];
  readonly approved: Array<{ id: string; reviewedById: string }> = [];

  async create(input: {
    incidentId: string;
    rootCause: string;
    rootCauseCategory: RcaRootCauseCategory;
    contributingFactors?: string | undefined;
    authoredById: string;
  }): Promise<{ id: string; authoredById: string }> {
    this.counter += 1;
    this.created.push({ incidentId: input.incidentId, authoredById: input.authoredById });
    return { id: `rca-${this.counter}`, authoredById: input.authoredById };
  }

  async submitForReview(id: string): Promise<unknown> {
    this.submitted.push(id);
    return { id };
  }

  async approve(id: string, reviewedById: string): Promise<unknown> {
    this.approved.push({ id, reviewedById });
    return { id };
  }
}

export class FakeDemoReviewerLookup implements ReviewerLookup {
  candidate: { id: string } | null = { id: 'reviewer-1' };

  async findReviewerCandidate(): Promise<{ id: string } | null> {
    return this.candidate;
  }
}
