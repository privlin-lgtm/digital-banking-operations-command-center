import type { DemoScenario, RcaRootCauseCategory } from '@prisma/client';
import type { RemediationActionType } from '../remediation/remediation.types.js';

export const DEMO_SCENARIOS = [
  'DATABASE_OUTAGE',
  'DEPENDENCY_FAILURE',
  'LATENCY_SPIKE',
  'DEPLOYMENT_FAILURE',
  'MEMORY_LEAK',
  'THIRD_PARTY_OUTAGE',
] as const satisfies readonly DemoScenario[];

interface DemoMetricStep {
  metricName: string;
  unit: string;
  /** Healthy value BASELINE records and REMEDIATING ramps back down to. */
  baseline: number;
  /** Value the primary metric snaps to on DEGRADING's final tick — comfortably past the real AlertRule's criticalThreshold. See DemoModeService.handleDegrading for why this is a snap, not a climb. */
  target: number;
}

/**
 * One archetype's full runtime definition: exactly the (service, metric)
 * pair that already has a real seeded AlertRule with real thresholds (see
 * apps/api/prisma/seed-history/config.ts's ALERT_RULE_DEFS) — Demo Mode
 * never invents a rule, it only drives an existing one past its own
 * criticalThreshold through the same MetricRecorder → MetricEvaluator path
 * a real monitoring agent uses. `correlated` and `synthetic` metrics have no
 * AlertRule of their own; they exist purely so the service's dashboards and
 * synthetic-transaction panels show a believable, multi-signal incident
 * instead of one isolated line moving.
 */
export interface DemoScenarioDef {
  key: DemoScenario;
  serviceSlug: string;
  rootCauseCategory: RcaRootCauseCategory;
  runbookSlug: string;
  /** Drives the real AlertRule; ramping this past its criticalThreshold is what makes the whole run real. */
  primary: DemoMetricStep;
  /** No AlertRule exists for these — recorded for dashboard realism only. */
  correlated: DemoMetricStep[];
  /** synthetic.*.success_rate / latency_ms metrics for the service's synthetic-transaction panels. */
  synthetic: DemoMetricStep[];
  /** Slow monotonic climb (never dips) instead of a noisy spike-and-recover envelope — only MEMORY_LEAK uses this. */
  ramp: boolean;
  remediationAction: RemediationActionType;
  titleThemes: string[];
  rootCauseTemplates: string[];
  contributingFactorTemplates: string[];
}

export const DEMO_SCENARIO_DEFS: Record<DemoScenario, DemoScenarioDef> = {
  DATABASE_OUTAGE: {
    key: 'DATABASE_OUTAGE',
    serviceSlug: 'core-banking-api',
    rootCauseCategory: 'INFRASTRUCTURE_FAILURE',
    runbookSlug: 'failover-core-database',
    primary: {
      metricName: 'db_connection_pool_used_percent',
      unit: 'percent',
      baseline: 28,
      target: 99,
    },
    correlated: [
      { metricName: 'error_rate_percent', unit: 'percent', baseline: 0.15, target: 3.5 },
      { metricName: 'availability_percent', unit: 'percent', baseline: 99.98, target: 91 },
    ],
    synthetic: [
      {
        metricName: 'synthetic.balance_check.success_rate',
        unit: 'percent',
        baseline: 99.6,
        target: 34,
      },
      {
        metricName: 'synthetic.balance_check.latency_ms',
        unit: 'ms',
        baseline: 190,
        target: 4800,
      },
    ],
    ramp: false,
    remediationAction: 'RECONNECT_DATABASE',
    titleThemes: ['connection pool exhaustion', 'primary database saturation'],
    rootCauseTemplates: [
      'The primary database connection pool saturated after {trigger}, leaving new queries queued until the pool timeout tripped.',
      'A spike in long-running transactions against the primary database exhausted the connection pool, starving the rest of the request path.',
    ],
    contributingFactorTemplates: [
      'The pool size had not been re-tuned since the last capacity review, and no early-warning alert existed below the saturation threshold.',
      'A recent traffic pattern shift increased average query hold time, quietly eating into pool headroom for several days before the breach.',
    ],
  },
  DEPENDENCY_FAILURE: {
    key: 'DEPENDENCY_FAILURE',
    serviceSlug: 'auth-service',
    rootCauseCategory: 'INFRASTRUCTURE_FAILURE',
    runbookSlug: 'restart-service-workers',
    primary: {
      metricName: 'error_rate_percent',
      unit: 'percent',
      baseline: 0.2,
      target: 11,
    },
    correlated: [
      { metricName: 'p99_latency_ms', unit: 'ms', baseline: 140, target: 2100 },
      { metricName: 'availability_percent', unit: 'percent', baseline: 99.97, target: 93.5 },
    ],
    synthetic: [
      { metricName: 'synthetic.login.success_rate', unit: 'percent', baseline: 99.5, target: 41 },
      { metricName: 'synthetic.login.latency_ms', unit: 'ms', baseline: 210, target: 3600 },
    ],
    ramp: false,
    remediationAction: 'RESTART_SERVICE',
    titleThemes: ['upstream identity-provider errors', 'session-store dependency failure'],
    rootCauseTemplates: [
      'A downstream identity-provider dependency started returning elevated error rates, and auth-service has no circuit breaker isolating it from that.',
      'The session store backing auth-service became unreachable for a subset of requests, surfacing as a sustained error-rate breach.',
    ],
    contributingFactorTemplates: [
      'Retries on the failing dependency were unbounded, amplifying load on an already-degraded upstream instead of backing off.',
      'The dependency has no independent health check, so its degradation was only visible through auth-service’s own error rate.',
    ],
  },
  LATENCY_SPIKE: {
    key: 'LATENCY_SPIKE',
    serviceSlug: 'mobile-bff',
    rootCauseCategory: 'CAPACITY_LIMIT',
    runbookSlug: 'scale-out-service-pods',
    primary: {
      metricName: 'p99_latency_ms',
      unit: 'ms',
      baseline: 180,
      target: 3600,
    },
    correlated: [
      { metricName: 'requests_per_second', unit: 'count', baseline: 140, target: 640 },
      { metricName: 'cpu_utilization_percent', unit: 'percent', baseline: 38, target: 96 },
    ],
    synthetic: [
      {
        metricName: 'synthetic.mobile_login.success_rate',
        unit: 'percent',
        baseline: 99.4,
        target: 58,
      },
      { metricName: 'synthetic.mobile_login.latency_ms', unit: 'ms', baseline: 260, target: 5200 },
    ],
    ramp: false,
    remediationAction: 'CLEAR_CACHE',
    titleThemes: ['mobile edge latency spike', 'retry-storm-driven saturation'],
    rootCauseTemplates: [
      'A slow upstream response triggered client-side retries, and the resulting retry storm pushed mobile-bff past its pod capacity.',
      'A cache-key regression caused a much higher fraction of requests to miss cache, driving p99 latency well past the alerting threshold.',
    ],
    contributingFactorTemplates: [
      'Autoscaling was tuned for average load, not the sudden step-change a retry storm produces, so headroom ran out before new pods came online.',
      'The mobile client’s retry policy has no jitter, so retries from many clients synchronized into repeated load bursts.',
    ],
  },
  DEPLOYMENT_FAILURE: {
    key: 'DEPLOYMENT_FAILURE',
    serviceSlug: 'card-processing',
    rootCauseCategory: 'CODE_DEFECT',
    runbookSlug: 'rollback-last-deployment',
    primary: {
      metricName: 'error_rate_percent',
      unit: 'percent',
      baseline: 0.1,
      target: 9.5,
    },
    correlated: [{ metricName: 'p99_latency_ms', unit: 'ms', baseline: 160, target: 1400 }],
    synthetic: [
      {
        metricName: 'synthetic.card_payment.success_rate',
        unit: 'percent',
        baseline: 99.5,
        target: 46,
      },
      { metricName: 'synthetic.card_payment.latency_ms', unit: 'ms', baseline: 220, target: 3900 },
    ],
    ramp: false,
    remediationAction: 'RESTART_SERVICE',
    titleThemes: ['bad deploy elevated errors', 'release regression'],
    rootCauseTemplates: [
      'The latest release shipped a regression in card-payment request validation that rejected a class of previously-valid requests.',
      'A configuration value baked into the last deployment pointed at the wrong downstream endpoint for a subset of traffic.',
    ],
    contributingFactorTemplates: [
      'The canary window for this release was shorter than the traffic pattern needed to surface the regression before full rollout.',
      'Pre-release testing did not cover the specific card-scheme path the regression affected.',
    ],
  },
  MEMORY_LEAK: {
    key: 'MEMORY_LEAK',
    serviceSlug: 'notification-service',
    rootCauseCategory: 'CODE_DEFECT',
    runbookSlug: 'restart-service-workers',
    primary: {
      metricName: 'memory_utilization_percent',
      unit: 'percent',
      baseline: 42,
      target: 97,
    },
    correlated: [{ metricName: 'error_rate_percent', unit: 'percent', baseline: 0.1, target: 4 }],
    synthetic: [],
    ramp: true,
    remediationAction: 'RESTART_SERVICE',
    titleThemes: ['gradual memory exhaustion', 'worker memory leak'],
    rootCauseTemplates: [
      'A recently-added notification-batching path holds references to completed batches longer than it should, leaking memory a little on every run.',
      'An event listener registered per-request was never deregistered, so memory climbed steadily with sustained traffic until workers began failing.',
    ],
    contributingFactorTemplates: [
      'There is no per-process memory ceiling that would have restarted the worker automatically before it reached exhaustion.',
      'The leak is slow enough that it only becomes visible after several hours of sustained traffic, past the window most load tests cover.',
    ],
  },
  THIRD_PARTY_OUTAGE: {
    key: 'THIRD_PARTY_OUTAGE',
    serviceSlug: 'payments-gateway',
    rootCauseCategory: 'THIRD_PARTY_DEPENDENCY',
    runbookSlug: 'activate-backup-provider',
    primary: {
      metricName: 'error_rate_percent',
      unit: 'percent',
      baseline: 0.12,
      target: 9,
    },
    correlated: [{ metricName: 'p99_latency_ms', unit: 'ms', baseline: 190, target: 2600 }],
    synthetic: [
      {
        metricName: 'synthetic.funds_transfer.success_rate',
        unit: 'percent',
        baseline: 99.3,
        target: 39,
      },
      {
        metricName: 'synthetic.funds_transfer.latency_ms',
        unit: 'ms',
        baseline: 240,
        target: 5100,
      },
    ],
    ramp: false,
    remediationAction: 'FAILOVER_SIMULATION',
    titleThemes: ['payment processor outage', 'card network connectivity loss'],
    rootCauseTemplates: [
      'The primary payment processor began rejecting a majority of authorization requests during a declared incident on their side.',
      'A card network connectivity issue outside BankOps’ control caused a sustained spike in gateway timeouts.',
    ],
    contributingFactorTemplates: [
      'The secondary processor failover path exists but is not automatically engaged below a manually-set error-rate floor.',
      'The processor’s own status page lagged the actual impact by several minutes, delaying confirmation this was not an internal fault.',
    ],
  },
};
