import type { CorrectiveActionType } from '@prisma/client';
import type { ArchetypeKey } from './config.js';

export interface TextContext {
  serviceName: string;
  trigger: string;
  vendor?: string | undefined;
  cascadeNames: string[];
  lagMinutes: number;
  rampHours?: number | undefined;
  runbookTitle: string;
}

export function titleText(archetype: ArchetypeKey, ctx: TextContext): string {
  switch (archetype) {
    case 'DATABASE_OUTAGE':
      return `Database connection pool exhaustion on ${ctx.serviceName}`;
    case 'DEPENDENCY_FAILURE':
      return ctx.cascadeNames.length > 0
        ? `${ctx.serviceName} degradation cascading to ${ctx.cascadeNames.join(', ')}`
        : `${ctx.serviceName} degradation impacting downstream consumers`;
    case 'LATENCY_SPIKE':
      return `Elevated latency on ${ctx.serviceName} during ${ctx.trigger}`;
    case 'DEPLOYMENT_FAILURE':
      return `Elevated error rate on ${ctx.serviceName} after latest deployment`;
    case 'MEMORY_LEAK':
      return `Memory leak causing restart loop on ${ctx.serviceName}`;
    case 'THIRD_PARTY_OUTAGE':
      return `${ctx.serviceName} impacted by an outage at ${ctx.vendor}`;
  }
}

export function rootCauseText(
  archetype: ArchetypeKey,
  ctx: TextContext,
  flagship: boolean,
): string {
  switch (archetype) {
    case 'DATABASE_OUTAGE':
      return `The primary database for ${ctx.serviceName} exhausted its connection pool after ${ctx.trigger}, causing new queries to queue and time out.`;
    case 'DEPENDENCY_FAILURE':
      return flagship
        ? `${ctx.serviceName} began rejecting a rising share of requests after ${ctx.trigger}; because ${ctx.cascadeNames.join(' and ')} call ${ctx.serviceName} synchronously with no circuit breaker, their own error rates climbed in lockstep about ${ctx.lagMinutes} minutes later.`
        : `${ctx.serviceName} began rejecting requests after ${ctx.trigger}, and the degradation propagated to services that depend on it directly.`;
    case 'LATENCY_SPIKE':
      return `${ctx.trigger} drove request volume on ${ctx.serviceName} well above baseline; autoscaling lagged the ramp by several minutes, so p99 latency climbed sharply before enough capacity came online.`;
    case 'DEPLOYMENT_FAILURE':
      return `The latest release to ${ctx.serviceName} shipped ${ctx.trigger}, which passed CI but surfaced only under production traffic; error rate climbed within minutes of rollout.`;
    case 'MEMORY_LEAK':
      return `A memory leak in ${ctx.serviceName}'s ${ctx.trigger} caused heap usage to climb steadily over roughly ${ctx.rampHours ?? 8} hours until pods began hitting their memory limit and were OOM-killed, producing a burst of errors during each restart cycle.`;
    case 'THIRD_PARTY_OUTAGE':
      return `${ctx.vendor} experienced an outage on their end, causing ${ctx.serviceName} calls through it to fail or time out; ${ctx.serviceName} has no automatic failover to a backup provider, so every dependent request failed too.`;
  }
}

export function contributingFactorsText(archetype: ArchetypeKey, ctx: TextContext): string {
  switch (archetype) {
    case 'DATABASE_OUTAGE':
      return 'No alert existed on connection-pool saturation until this incident; pool size had not been re-tuned since traffic grew.';
    case 'DEPENDENCY_FAILURE':
      return `${ctx.cascadeNames[0] ?? 'The dependent service'} has no circuit breaker or bulkhead around its ${ctx.serviceName} client, so an upstream degradation propagates directly into its own error budget.`;
    case 'LATENCY_SPIKE':
      return "The autoscaler's scale-up cooldown is tuned for steady growth, not a sudden step-change in traffic.";
    case 'DEPLOYMENT_FAILURE':
      return 'The canary stage ran too briefly and at too little traffic to catch a defect that only manifests under sustained load.';
    case 'MEMORY_LEAK':
      return 'There was no alert on the sustained upward memory trend itself, only on the absolute threshold, so the leak was visible in hindsight for hours before anyone was paged.';
    case 'THIRD_PARTY_OUTAGE':
      return `${ctx.serviceName} treats ${ctx.vendor} as a hard dependency with no fallback path, so a third-party outage becomes a full outage on this side with zero internal recourse.`;
  }
}

export function resolutionSummaryText(archetype: ArchetypeKey, ctx: TextContext): string {
  switch (archetype) {
    case 'DATABASE_OUTAGE':
      return `Failed over to the standby database and redirected traffic; resolved via "${ctx.runbookTitle}".`;
    case 'DEPENDENCY_FAILURE':
      return `Restarted the affected workers and confirmed error rates recovered on both ${ctx.serviceName} and its dependents; resolved via "${ctx.runbookTitle}".`;
    case 'LATENCY_SPIKE':
      return `Scaled out additional capacity; latency returned to baseline once the new pods came online. Resolved via "${ctx.runbookTitle}".`;
    case 'DEPLOYMENT_FAILURE':
      return `Rolled back the deployment; error rate recovered within minutes. Resolved via "${ctx.runbookTitle}".`;
    case 'MEMORY_LEAK':
      return `Restarted the affected workers to reclaim memory as an immediate mitigation via "${ctx.runbookTitle}"; a permanent fix was tracked as a corrective action.`;
    case 'THIRD_PARTY_OUTAGE':
      return `Activated the backup provider until the vendor's outage cleared; resolved via "${ctx.runbookTitle}".`;
  }
}

export function correctiveActionsFor(
  archetype: ArchetypeKey,
  ctx: TextContext,
): { type: CorrectiveActionType; description: string }[] {
  switch (archetype) {
    case 'DATABASE_OUTAGE':
      return [
        {
          type: 'PREVENTIVE',
          description: `Add a saturation alert on ${ctx.serviceName}'s DB connection pool at 80%.`,
        },
        {
          type: 'CORRECTIVE',
          description: `Increase max pool size and add a connection pooler in front of ${ctx.serviceName}'s primary database.`,
        },
        {
          type: 'PREVENTIVE',
          description:
            'Add a load-test gate to CI for connection-pool behavior under sustained query volume.',
        },
      ];
    case 'DEPENDENCY_FAILURE':
      return [
        {
          type: 'PREVENTIVE',
          description: `Add a circuit breaker to ${ctx.cascadeNames[0] ?? 'the dependent service'}'s ${ctx.serviceName} client with a fast-fail fallback.`,
        },
        {
          type: 'PREVENTIVE',
          description: `Document the ${ctx.serviceName} hard dependency in the service catalog's on-call runbook.`,
        },
      ];
    case 'LATENCY_SPIKE':
      return [
        {
          type: 'PREVENTIVE',
          description: `Lower the autoscaler's scale-up cooldown for ${ctx.serviceName} from 5 minutes to 90 seconds.`,
        },
        {
          type: 'CORRECTIVE',
          description: `Pre-warm additional ${ctx.serviceName} capacity ahead of known high-volume windows.`,
        },
      ];
    case 'DEPLOYMENT_FAILURE':
      return [
        {
          type: 'PREVENTIVE',
          description: `Extend the canary window for ${ctx.serviceName} from 3 minutes to 20 minutes before full rollout.`,
        },
        {
          type: 'CORRECTIVE',
          description:
            'Add an automated rollback trigger keyed to error-rate regression during canary.',
        },
      ];
    case 'MEMORY_LEAK':
      return [
        {
          type: 'PREVENTIVE',
          description:
            'Add a rate-of-change alert on memory utilization, not just a static threshold.',
        },
        {
          type: 'CORRECTIVE',
          description: `Fix the leak in ${ctx.serviceName} and add a heap-profiling regression test.`,
        },
        {
          type: 'PREVENTIVE',
          description:
            'Set a lower, tiered memory limit with a graceful restart before the hard OOM kill.',
        },
      ];
    case 'THIRD_PARTY_OUTAGE':
      return [
        {
          type: 'PREVENTIVE',
          description: `Onboard a secondary provider for ${ctx.vendor ?? 'this dependency'} and implement automatic failover.`,
        },
        {
          type: 'CORRECTIVE',
          description: `Add a circuit breaker around the ${ctx.vendor ?? 'vendor'} client that fails fast and queues for retry instead of blocking.`,
        },
      ];
  }
}
