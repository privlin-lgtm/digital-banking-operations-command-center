import type { PrismaClient, Severity, User } from '@prisma/client';
import { requiresRcaToClose, severityPolicy } from '../../src/modules/incidents/severity.js';
import { ARCHETYPES, FLAGSHIP_EXTERNAL_REFS, SERVICES } from './config.js';
import type { StoryBeat } from './narrative.js';
import {
  contributingFactorsText,
  correctiveActionsFor,
  resolutionSummaryText,
  rootCauseText,
  titleText,
  type TextContext,
} from './narrative-text.js';
import { chance, pick, randInt, type Rng } from './rng.js';

const SERVICE_BY_KEY = new Map(SERVICES.map((s) => [s.key, s]));

export interface IncidentGenContext {
  serviceIdByKey: Map<string, string>;
  runbookByKey: Map<string, { id: string; version: number; title: string }>;
  admin: User;
  commanders: User[];
  responders: User[];
  now: Date;
}

export interface IncidentSummary {
  serviceKey: string;
  severity: Severity;
  openedAt: Date;
  resolvedAt: Date | null;
  firstAlertFiredAt: Date;
}

function detectionDelayMinutes(rng: Rng, severity: Severity): number {
  switch (severity) {
    case 'SEV1':
      return randInt(rng, 1, 4);
    case 'SEV2':
      return randInt(rng, 2, 8);
    case 'SEV3':
      return randInt(rng, 5, 15);
    case 'SEV4':
      return randInt(rng, 10, 30);
  }
}

export async function generateIncidents(
  prisma: PrismaClient,
  rng: Rng,
  beats: StoryBeat[],
  ctx: IncidentGenContext,
): Promise<{
  summaries: IncidentSummary[];
  incidentCount: number;
  alertCount: number;
  rcaCount: number;
}> {
  const summaries: IncidentSummary[] = [];
  let alertCount = 0;
  let rcaCount = 0;

  for (const beat of beats) {
    if (beat.kind !== 'INCIDENT') continue;

    const service = SERVICE_BY_KEY.get(beat.serviceKey);
    if (!service) continue;
    const serviceId = ctx.serviceIdByKey.get(beat.serviceKey);
    if (!serviceId) continue;

    const archetypeDef = ARCHETYPES[beat.archetype];
    let steps = archetypeDef.alertSequence.filter((s) => service.metrics.includes(s.metric));
    if (steps.length === 0) {
      steps = [
        {
          metric: service.metrics[0] ?? 'error_rate_percent',
          delayMinutes: 0,
          ruleName: 'error_rate_high',
        },
      ];
    }
    if (beat.archetype === 'THIRD_PARTY_OUTAGE') {
      const syntheticMetric = service.metrics.find(
        (m) => m.startsWith('synthetic.') && m.endsWith('success_rate'),
      );
      if (syntheticMetric) {
        steps = [
          { metric: syntheticMetric, delayMinutes: -2, ruleName: 'synthetic_probe_failure' },
          ...steps,
        ];
      }
    }

    const firstAlertOffsetMin = Math.min(...steps.map((s) => s.delayMinutes));
    const firstAlertFiredAt = new Date(beat.start.getTime() + firstAlertOffsetMin * 60_000);
    const openedAt = new Date(
      firstAlertFiredAt.getTime() + detectionDelayMinutes(rng, beat.severity) * 60_000,
    );

    const policy = severityPolicy(beat.severity);
    const forcedBreach = beat.id === 'flagship-db-outage' || beat.id === 'flagship-memory-leak';
    const ackBreach = beat.inProgress ? false : forcedBreach || chance(rng, 0.22);

    let acknowledgedAt: Date;
    if (beat.inProgress) {
      acknowledgedAt = new Date(openedAt.getTime() + randInt(rng, 1, 4) * 60_000);
    } else if (ackBreach) {
      acknowledgedAt = new Date(
        openedAt.getTime() + policy.ackSlaMinutes * 60_000 * randInt(rng, 13, 30) * 0.1,
      );
    } else {
      acknowledgedAt = new Date(
        openedAt.getTime() + policy.ackSlaMinutes * 60_000 * randInt(rng, 2, 9) * 0.1,
      );
    }
    if (acknowledgedAt.getTime() > beat.end.getTime() - 60_000) {
      acknowledgedAt = new Date(Math.max(openedAt.getTime() + 60_000, beat.end.getTime() - 60_000));
    }

    let escalationLevel = 0;
    let lastEscalatedAt: Date | null = null;
    if (ackBreach) {
      escalationLevel = Math.min(randInt(rng, 1, 2), policy.escalationChain.length);
      const candidate = new Date(
        openedAt.getTime() +
          (policy.ackSlaMinutes + policy.escalateAfterMinutes * escalationLevel) * 60_000,
      );
      lastEscalatedAt = new Date(Math.min(candidate.getTime(), acknowledgedAt.getTime() - 30_000));
    }

    let resolvedAt: Date | null = null;
    let closedAt: Date | null = null;
    let status: 'ACKNOWLEDGED' | 'RESOLVED' | 'CLOSED';

    if (beat.inProgress) {
      status = 'ACKNOWLEDGED';
    } else {
      resolvedAt = new Date(
        Math.min(beat.end.getTime() + randInt(rng, 0, 5) * 60_000, ctx.now.getTime()),
      );
      const needsRca = requiresRcaToClose(beat.severity);
      const turnaroundMs = needsRca
        ? randInt(rng, 24, 120) * 3_600_000
        : randInt(rng, 1, 48) * 3_600_000;
      const potentialClosedAt = new Date(resolvedAt.getTime() + turnaroundMs);
      if (potentialClosedAt.getTime() <= ctx.now.getTime()) {
        closedAt = potentialClosedAt;
        status = 'CLOSED';
      } else {
        status = 'RESOLVED';
      }
    }

    let commanderId: string | null = null;
    if (
      beat.severity === 'SEV1' ||
      beat.severity === 'SEV2' ||
      (beat.severity === 'SEV3' && chance(rng, 0.3))
    ) {
      commanderId = pick(rng, ctx.commanders).id;
    }
    const responder = pick(rng, ctx.responders);

    const cascadeNames = beat.cascadeTo
      .map((k) => SERVICE_BY_KEY.get(k)?.name)
      .filter((n): n is string => Boolean(n));
    const runbookInfo = ctx.runbookByKey.get(archetypeDef.runbookSlug);
    const textCtx: TextContext = {
      serviceName: service.name,
      trigger: beat.triggerVariant,
      vendor: beat.vendor,
      cascadeNames,
      lagMinutes: randInt(rng, 3, 7),
      rampHours: beat.rampHours,
      runbookTitle: runbookInfo?.title ?? 'the standard remediation runbook',
    };

    const title = titleText(beat.archetype, textCtx);
    const resolutionSummary = resolvedAt ? resolutionSummaryText(beat.archetype, textCtx) : null;
    const externalRefs = FLAGSHIP_EXTERNAL_REFS[beat.id];

    const incident = await prisma.incident.create({
      data: {
        title,
        severity: beat.severity,
        status,
        primaryServiceId: serviceId,
        commanderId,
        openedAt,
        acknowledgedAt,
        resolvedAt,
        closedAt,
        resolutionSummary,
        escalationLevel,
        lastEscalatedAt,
        ...(externalRefs
          ? {
              externalTicketUrl: externalRefs.externalTicketUrl,
              statusPageUrl: externalRefs.statusPageUrl,
            }
          : {}),
      },
    });

    for (const step of steps) {
      const firedAt = new Date(beat.start.getTime() + step.delayMinutes * 60_000);
      await prisma.alert.create({
        data: {
          serviceId,
          incidentId: incident.id,
          ruleName: step.ruleName,
          severity: beat.severity,
          state: beat.inProgress ? 'ACKNOWLEDGED' : 'RESOLVED',
          fingerprint: `${step.ruleName}:${service.slug}`,
          firedAt,
          resolvedAt: beat.inProgress ? null : resolvedAt,
        },
      });
      alertCount += 1;
    }

    const timelineEvents: {
      type: 'CREATED' | 'ACKNOWLEDGED' | 'ESCALATED' | 'MITIGATED' | 'RESOLVED' | 'CLOSED';
      message: string;
      actorId: string | null;
      createdAt: Date;
    }[] = [
      { type: 'CREATED', message: `Incident opened: ${title}`, actorId: null, createdAt: openedAt },
      {
        type: 'ACKNOWLEDGED',
        message: `Acknowledged by ${commanderId ? 'the on-call commander' : responder.name}`,
        actorId: commanderId ?? responder.id,
        createdAt: acknowledgedAt,
      },
    ];
    if (escalationLevel > 0 && lastEscalatedAt) {
      const toRole = policy.escalationChain[escalationLevel - 1] ?? policy.escalationChain[0];
      timelineEvents.push({
        type: 'ESCALATED',
        message: `Escalated to ${toRole} — acknowledgement SLA breached`,
        actorId: null,
        createdAt: lastEscalatedAt,
      });
    }
    if (beat.inProgress) {
      timelineEvents.push({
        type: 'MITIGATED',
        message: 'Initial mitigation attempted; monitoring for full recovery',
        actorId: responder.id,
        createdAt: new Date(ctx.now.getTime() - randInt(rng, 2, 10) * 60_000),
      });
    } else if (resolvedAt) {
      const mitigatedAt = new Date(
        acknowledgedAt.getTime() +
          Math.round((resolvedAt.getTime() - acknowledgedAt.getTime()) * 0.6),
      );
      timelineEvents.push({
        type: 'MITIGATED',
        message: 'Mitigation applied; impact reducing',
        actorId: responder.id,
        createdAt: mitigatedAt,
      });
      timelineEvents.push({
        type: 'RESOLVED',
        message: resolutionSummary ?? 'Resolved',
        actorId: commanderId ?? responder.id,
        createdAt: resolvedAt,
      });
      if (closedAt) {
        timelineEvents.push({
          type: 'CLOSED',
          message: 'Incident closed',
          actorId: commanderId ?? ctx.admin.id,
          createdAt: closedAt,
        });
      }
    }
    await prisma.incidentTimelineEvent.createMany({
      data: timelineEvents.map((e) => ({ ...e, incidentId: incident.id })),
    });

    if (beat.flagship || chance(rng, 0.35)) {
      await prisma.incidentComment.create({
        data: {
          incidentId: incident.id,
          authorId: responder.id,
          body: `Correlated with the alert sequence above; proceeding with the standard runbook for this failure mode (${beat.triggerVariant || 'root cause under investigation'}).`,
          createdAt: new Date(acknowledgedAt.getTime() + 60_000),
        },
      });
    }

    if (runbookInfo && !(beat.severity === 'SEV4' && chance(rng, 0.5))) {
      const outcomeRoll = rng();
      const outcome = beat.inProgress
        ? 'PENDING'
        : outcomeRoll < 0.08
          ? 'FAILURE'
          : outcomeRoll < 0.22
            ? 'PARTIAL'
            : 'SUCCESS';
      const firstExecAt = new Date(
        acknowledgedAt.getTime() +
          Math.round(((resolvedAt ?? ctx.now).getTime() - acknowledgedAt.getTime()) * 0.5),
      );
      await prisma.incidentRunbook.create({
        data: {
          incidentId: incident.id,
          runbookId: runbookInfo.id,
          runbookVersion: runbookInfo.version,
          executedById: responder.id,
          executedAutomatically: false,
          outcome,
          executedAt: firstExecAt,
        },
      });
      if (outcome === 'PARTIAL' && resolvedAt) {
        await prisma.incidentRunbook.create({
          data: {
            incidentId: incident.id,
            runbookId: runbookInfo.id,
            runbookVersion: runbookInfo.version,
            executedById: responder.id,
            executedAutomatically: false,
            outcome: 'SUCCESS',
            executedAt: new Date(resolvedAt.getTime() - 2 * 60_000),
          },
        });
      }
    }

    const needsRca = requiresRcaToClose(beat.severity);
    const wantsOptionalRca = !needsRca && chance(rng, 0.25);
    if ((needsRca || wantsOptionalRca) && resolvedAt) {
      const rcaStatus = status === 'CLOSED' ? 'APPROVED' : chance(rng, 0.5) ? 'IN_REVIEW' : 'DRAFT';
      const author = pick(rng, ctx.responders);
      const reviewer = pick(rng, ctx.commanders);
      const rca = await prisma.rcaReport.create({
        data: {
          incidentId: incident.id,
          rootCause: rootCauseText(beat.archetype, textCtx, beat.flagship),
          rootCauseCategory: archetypeDef.rootCauseCategory,
          contributingFactors: contributingFactorsText(beat.archetype, textCtx),
          authoredById: author.id,
          reviewedById:
            rcaStatus === 'APPROVED' ? reviewer.id : chance(rng, 0.5) ? reviewer.id : null,
          status: rcaStatus,
          publishedAt: rcaStatus === 'APPROVED' ? closedAt : null,
        },
      });
      rcaCount += 1;

      const actions = correctiveActionsFor(beat.archetype, textCtx);
      for (const action of actions) {
        const owner = pick(rng, ctx.responders);
        const anchor = closedAt ?? resolvedAt;
        const dueDate = new Date(anchor.getTime() + randInt(rng, 7, 45) * 86_400_000);
        const isComplete =
          dueDate.getTime() < ctx.now.getTime() ? chance(rng, 0.7) : chance(rng, 0.15);
        await prisma.correctiveAction.create({
          data: {
            rcaReportId: rca.id,
            type: action.type,
            description: action.description,
            ownerId: owner.id,
            dueDate,
            isComplete,
          },
        });
      }
    }

    summaries.push({
      serviceKey: beat.serviceKey,
      severity: beat.severity,
      openedAt,
      resolvedAt,
      firstAlertFiredAt,
    });
  }

  return { summaries, incidentCount: summaries.length, alertCount, rcaCount };
}
