import type {
  AlertComparator,
  DependencyType,
  RcaRootCauseCategory,
  RunbookCategory,
  ServiceTier,
} from '@prisma/client';

/** How far back the fabricated history reaches, ending "now". */
export const HISTORY_DAYS = 183;
/** Fixed seed: re-running the generator against a fresh database reproduces the same story. */
export const SEED = 20260301;

export interface ServiceDef {
  key: string;
  name: string;
  slug: string;
  tier: ServiceTier;
  ownerTeam: string;
  dependsOn: { key: string; type: DependencyType }[];
  metrics: string[];
}

// A medium bank's core digital-operations footprint: edge, identity, ledger,
// payments/cards, risk, compliance, batch, and the customer-facing channels
// that sit on top of them. Dependency edges mirror how an outage in one
// actually reaches the others below.
export const SERVICES: ServiceDef[] = [
  {
    key: 'api-gateway',
    name: 'API Gateway',
    slug: 'api-gateway',
    tier: 'TIER_1',
    ownerTeam: 'Platform Engineering',
    dependsOn: [],
    metrics: [
      'error_rate_percent',
      'p99_latency_ms',
      'cpu_utilization_percent',
      'memory_utilization_percent',
      'availability_percent',
      'requests_per_second',
    ],
  },
  {
    key: 'auth-service',
    name: 'Auth Service',
    slug: 'auth-service',
    tier: 'TIER_1',
    ownerTeam: 'Identity',
    dependsOn: [{ key: 'api-gateway', type: 'HARD' }],
    metrics: [
      'error_rate_percent',
      'p99_latency_ms',
      'cpu_utilization_percent',
      'memory_utilization_percent',
      'availability_percent',
      'synthetic.login.success_rate',
      'synthetic.login.latency_ms',
    ],
  },
  {
    key: 'core-banking-api',
    name: 'Core Banking API',
    slug: 'core-banking-api',
    tier: 'TIER_1',
    ownerTeam: 'Core Platform',
    dependsOn: [{ key: 'api-gateway', type: 'HARD' }],
    metrics: [
      'error_rate_percent',
      'p99_latency_ms',
      'cpu_utilization_percent',
      'memory_utilization_percent',
      'availability_percent',
      'db_connection_pool_used_percent',
      'synthetic.balance_check.success_rate',
      'synthetic.balance_check.latency_ms',
    ],
  },
  {
    key: 'payments-gateway',
    name: 'Payments Gateway',
    slug: 'payments-gateway',
    tier: 'TIER_1',
    ownerTeam: 'Payments',
    dependsOn: [
      { key: 'api-gateway', type: 'HARD' },
      { key: 'auth-service', type: 'HARD' },
      { key: 'core-banking-api', type: 'HARD' },
      { key: 'fraud-detection', type: 'SOFT' },
    ],
    metrics: [
      'error_rate_percent',
      'p99_latency_ms',
      'cpu_utilization_percent',
      'memory_utilization_percent',
      'availability_percent',
      'requests_per_second',
      'synthetic.funds_transfer.success_rate',
      'synthetic.funds_transfer.latency_ms',
    ],
  },
  {
    key: 'card-processing',
    name: 'Card Processing',
    slug: 'card-processing',
    tier: 'TIER_1',
    ownerTeam: 'Payments',
    dependsOn: [
      { key: 'api-gateway', type: 'HARD' },
      { key: 'auth-service', type: 'HARD' },
      { key: 'fraud-detection', type: 'SOFT' },
    ],
    metrics: [
      'error_rate_percent',
      'p99_latency_ms',
      'cpu_utilization_percent',
      'memory_utilization_percent',
      'availability_percent',
      'synthetic.card_payment.success_rate',
      'synthetic.card_payment.latency_ms',
    ],
  },
  {
    key: 'fraud-detection',
    name: 'Fraud Detection',
    slug: 'fraud-detection',
    tier: 'TIER_2',
    ownerTeam: 'Risk',
    dependsOn: [{ key: 'api-gateway', type: 'HARD' }],
    metrics: [
      'error_rate_percent',
      'p99_latency_ms',
      'cpu_utilization_percent',
      'memory_utilization_percent',
      'availability_percent',
    ],
  },
  {
    key: 'ledger-sync',
    name: 'Ledger Sync',
    slug: 'ledger-sync',
    tier: 'TIER_2',
    ownerTeam: 'Core Platform',
    dependsOn: [{ key: 'core-banking-api', type: 'HARD' }],
    metrics: [
      'error_rate_percent',
      'availability_percent',
      'sync_lag_seconds',
      'queue_depth',
      'memory_utilization_percent',
    ],
  },
  {
    key: 'kyc-service',
    name: 'KYC Service',
    slug: 'kyc-service',
    tier: 'TIER_2',
    ownerTeam: 'Compliance',
    dependsOn: [
      { key: 'api-gateway', type: 'HARD' },
      { key: 'auth-service', type: 'SOFT' },
      { key: 'notification-service', type: 'SOFT' },
    ],
    metrics: [
      'error_rate_percent',
      'p99_latency_ms',
      'availability_percent',
      'db_connection_pool_used_percent',
      'queue_depth',
    ],
  },
  {
    key: 'mobile-bff',
    name: 'Mobile BFF',
    slug: 'mobile-bff',
    tier: 'TIER_2',
    ownerTeam: 'Digital Channels',
    dependsOn: [
      { key: 'api-gateway', type: 'HARD' },
      { key: 'auth-service', type: 'HARD' },
      { key: 'core-banking-api', type: 'HARD' },
    ],
    metrics: [
      'error_rate_percent',
      'p99_latency_ms',
      'cpu_utilization_percent',
      'memory_utilization_percent',
      'availability_percent',
      'requests_per_second',
      'synthetic.mobile_login.success_rate',
      'synthetic.mobile_login.latency_ms',
    ],
  },
  {
    key: 'notification-service',
    name: 'Notification Service',
    slug: 'notification-service',
    tier: 'TIER_3',
    ownerTeam: 'Platform Engineering',
    dependsOn: [{ key: 'api-gateway', type: 'HARD' }],
    metrics: [
      'error_rate_percent',
      'p99_latency_ms',
      'memory_utilization_percent',
      'availability_percent',
      'queue_depth',
    ],
  },
  {
    key: 'reporting-batch',
    name: 'Reporting Batch',
    slug: 'reporting-batch',
    tier: 'TIER_4',
    ownerTeam: 'Data Platform',
    dependsOn: [
      { key: 'core-banking-api', type: 'HARD' },
      { key: 'ledger-sync', type: 'HARD' },
    ],
    metrics: [
      'error_rate_percent',
      'availability_percent',
      'queue_depth',
      'db_connection_pool_used_percent',
    ],
  },
  {
    key: 'audit-ledger-archive',
    name: 'Audit Ledger Archive',
    slug: 'audit-ledger-archive',
    tier: 'TIER_3',
    ownerTeam: 'Compliance',
    dependsOn: [{ key: 'core-banking-api', type: 'SOFT' }],
    metrics: ['error_rate_percent', 'availability_percent', 'memory_utilization_percent'],
  },
];

export type MetricDirection = 'up' | 'down';

export interface MetricConfig {
  unit: string;
  baseline: [number, number];
  diurnal: boolean;
  direction: MetricDirection;
  /** Value range the metric swings to while a beat actively impacts it. */
  impactRange: [number, number];
  /** Clamp so noise/impact never produces a nonsensical reading (e.g. negative percent). */
  clamp: [number, number];
}

const percentClamp: [number, number] = [0, 100];

export const METRIC_CONFIG: Record<string, MetricConfig> = {
  error_rate_percent: {
    unit: 'percent',
    baseline: [0.02, 0.4],
    diurnal: false,
    direction: 'up',
    impactRange: [4, 35],
    clamp: percentClamp,
  },
  p99_latency_ms: {
    unit: 'ms',
    baseline: [90, 260],
    diurnal: true,
    direction: 'up',
    impactRange: [1200, 6000],
    clamp: [20, 15000],
  },
  cpu_utilization_percent: {
    unit: 'percent',
    baseline: [28, 55],
    diurnal: true,
    direction: 'up',
    impactRange: [88, 99],
    clamp: percentClamp,
  },
  memory_utilization_percent: {
    unit: 'percent',
    baseline: [35, 60],
    diurnal: false,
    direction: 'up',
    impactRange: [90, 99],
    clamp: percentClamp,
  },
  availability_percent: {
    unit: 'percent',
    baseline: [99.95, 100],
    diurnal: false,
    direction: 'down',
    impactRange: [80, 99.5],
    clamp: percentClamp,
  },
  db_connection_pool_used_percent: {
    unit: 'percent',
    baseline: [15, 45],
    diurnal: true,
    direction: 'up',
    impactRange: [92, 100],
    clamp: percentClamp,
  },
  sync_lag_seconds: {
    unit: 'seconds',
    baseline: [3, 25],
    diurnal: false,
    direction: 'up',
    impactRange: [180, 900],
    clamp: [0, 3600],
  },
  queue_depth: {
    unit: 'count',
    baseline: [0, 25],
    diurnal: true,
    direction: 'up',
    impactRange: [200, 3000],
    clamp: [0, 20000],
  },
  requests_per_second: {
    unit: 'count',
    baseline: [40, 220],
    diurnal: true,
    direction: 'up',
    impactRange: [15, 700],
    clamp: [0, 5000],
  },
  'synthetic.login.success_rate': {
    unit: 'percent',
    baseline: [98.5, 100],
    diurnal: false,
    direction: 'down',
    impactRange: [0, 55],
    clamp: percentClamp,
  },
  'synthetic.login.latency_ms': {
    unit: 'ms',
    baseline: [120, 320],
    diurnal: false,
    direction: 'up',
    impactRange: [1500, 8000],
    clamp: [20, 15000],
  },
  'synthetic.balance_check.success_rate': {
    unit: 'percent',
    baseline: [98.5, 100],
    diurnal: false,
    direction: 'down',
    impactRange: [0, 55],
    clamp: percentClamp,
  },
  'synthetic.balance_check.latency_ms': {
    unit: 'ms',
    baseline: [110, 300],
    diurnal: false,
    direction: 'up',
    impactRange: [1500, 8000],
    clamp: [20, 15000],
  },
  'synthetic.funds_transfer.success_rate': {
    unit: 'percent',
    baseline: [98, 100],
    diurnal: false,
    direction: 'down',
    impactRange: [0, 55],
    clamp: percentClamp,
  },
  'synthetic.funds_transfer.latency_ms': {
    unit: 'ms',
    baseline: [180, 400],
    diurnal: false,
    direction: 'up',
    impactRange: [1800, 9000],
    clamp: [20, 15000],
  },
  'synthetic.card_payment.success_rate': {
    unit: 'percent',
    baseline: [98.5, 100],
    diurnal: false,
    direction: 'down',
    impactRange: [0, 55],
    clamp: percentClamp,
  },
  'synthetic.card_payment.latency_ms': {
    unit: 'ms',
    baseline: [150, 350],
    diurnal: false,
    direction: 'up',
    impactRange: [1500, 8000],
    clamp: [20, 15000],
  },
  'synthetic.mobile_login.success_rate': {
    unit: 'percent',
    baseline: [98.5, 100],
    diurnal: false,
    direction: 'down',
    impactRange: [0, 55],
    clamp: percentClamp,
  },
  'synthetic.mobile_login.latency_ms': {
    unit: 'ms',
    baseline: [130, 340],
    diurnal: false,
    direction: 'up',
    impactRange: [1500, 8000],
    clamp: [20, 15000],
  },
};

export type ArchetypeKey =
  | 'DATABASE_OUTAGE'
  | 'DEPENDENCY_FAILURE'
  | 'LATENCY_SPIKE'
  | 'DEPLOYMENT_FAILURE'
  | 'MEMORY_LEAK'
  | 'THIRD_PARTY_OUTAGE';

export interface AlertStep {
  metric: string;
  delayMinutes: number;
  ruleName: string;
}

export interface ArchetypeDef {
  key: ArchetypeKey;
  rootCauseCategory: RcaRootCauseCategory;
  primaryMetric: string;
  alertSequence: AlertStep[];
  runbookSlug: string;
  /** True for the slow-ramp memory-leak shape rather than a symmetric spike envelope. */
  ramp?: boolean;
}

export const ARCHETYPES: Record<ArchetypeKey, ArchetypeDef> = {
  DATABASE_OUTAGE: {
    key: 'DATABASE_OUTAGE',
    rootCauseCategory: 'INFRASTRUCTURE_FAILURE',
    primaryMetric: 'db_connection_pool_used_percent',
    alertSequence: [
      {
        metric: 'db_connection_pool_used_percent',
        delayMinutes: 0,
        ruleName: 'db_pool_saturation',
      },
      { metric: 'error_rate_percent', delayMinutes: 2, ruleName: 'error_rate_high' },
      { metric: 'availability_percent', delayMinutes: 4, ruleName: 'availability_low' },
    ],
    runbookSlug: 'failover-core-database',
  },
  DEPENDENCY_FAILURE: {
    key: 'DEPENDENCY_FAILURE',
    rootCauseCategory: 'INFRASTRUCTURE_FAILURE',
    primaryMetric: 'error_rate_percent',
    alertSequence: [{ metric: 'error_rate_percent', delayMinutes: 0, ruleName: 'error_rate_high' }],
    runbookSlug: 'restart-service-workers',
  },
  LATENCY_SPIKE: {
    key: 'LATENCY_SPIKE',
    rootCauseCategory: 'CAPACITY_LIMIT',
    primaryMetric: 'p99_latency_ms',
    alertSequence: [
      { metric: 'p99_latency_ms', delayMinutes: 0, ruleName: 'latency_p99_high' },
      { metric: 'requests_per_second', delayMinutes: 3, ruleName: 'traffic_retry_storm' },
      { metric: 'cpu_utilization_percent', delayMinutes: 6, ruleName: 'cpu_saturation' },
    ],
    runbookSlug: 'scale-out-service-pods',
  },
  DEPLOYMENT_FAILURE: {
    key: 'DEPLOYMENT_FAILURE',
    rootCauseCategory: 'CODE_DEFECT',
    primaryMetric: 'error_rate_percent',
    alertSequence: [
      { metric: 'error_rate_percent', delayMinutes: 0, ruleName: 'error_rate_high' },
      { metric: 'p99_latency_ms', delayMinutes: 2, ruleName: 'latency_p99_high' },
    ],
    runbookSlug: 'rollback-last-deployment',
  },
  MEMORY_LEAK: {
    key: 'MEMORY_LEAK',
    rootCauseCategory: 'CODE_DEFECT',
    primaryMetric: 'memory_utilization_percent',
    alertSequence: [
      { metric: 'memory_utilization_percent', delayMinutes: 0, ruleName: 'memory_saturation' },
      { metric: 'error_rate_percent', delayMinutes: 20, ruleName: 'error_rate_high' },
    ],
    runbookSlug: 'restart-service-workers',
    ramp: true,
  },
  THIRD_PARTY_OUTAGE: {
    key: 'THIRD_PARTY_OUTAGE',
    rootCauseCategory: 'THIRD_PARTY_DEPENDENCY',
    primaryMetric: 'error_rate_percent',
    alertSequence: [{ metric: 'error_rate_percent', delayMinutes: 2, ruleName: 'error_rate_high' }],
    runbookSlug: 'activate-backup-provider',
  },
};

export interface RunbookDef {
  title: string;
  slug: string;
  category: RunbookCategory;
  triggerCondition: string;
  steps: { order: number; action: string; target: string; replicas?: number }[];
}

export const RUNBOOKS: RunbookDef[] = [
  {
    title: 'Fail Over Core Database',
    slug: 'failover-core-database',
    category: 'DATABASE',
    triggerCondition: 'db_connection_pool_used_percent > 90 for 3m',
    steps: [
      { order: 1, action: 'promote_replica', target: 'primary-standby' },
      { order: 2, action: 'redirect_traffic', target: 'db-proxy' },
      { order: 3, action: 'verify_replication_lag', target: 'primary-standby' },
    ],
  },
  {
    title: 'Expand Database Connection Pool',
    slug: 'expand-connection-pool',
    category: 'DATABASE',
    triggerCondition: 'db_connection_pool_used_percent > 80 for 10m',
    steps: [
      { order: 1, action: 'increase_pool_size', target: 'pgbouncer' },
      { order: 2, action: 'restart_pool_manager', target: 'pgbouncer' },
    ],
  },
  {
    title: 'Restart Service Workers',
    slug: 'restart-service-workers',
    category: 'APPLICATION',
    triggerCondition: 'error_rate_percent > 5 for 5m',
    steps: [
      { order: 1, action: 'scale_down', target: 'service-workers', replicas: 0 },
      { order: 2, action: 'clear_local_cache', target: 'service-workers' },
      { order: 3, action: 'scale_up', target: 'service-workers', replicas: 4 },
    ],
  },
  {
    title: 'Scale Out Service Pods',
    slug: 'scale-out-service-pods',
    category: 'INFRASTRUCTURE',
    triggerCondition: 'p99_latency_ms > 1000 for 5m',
    steps: [
      { order: 1, action: 'increase_replica_count', target: 'service-deployment' },
      { order: 2, action: 'verify_load_balancer_health', target: 'service-deployment' },
    ],
  },
  {
    title: 'Rollback Last Deployment',
    slug: 'rollback-last-deployment',
    category: 'APPLICATION',
    triggerCondition: 'error_rate_percent > 5 within 10m of a deploy',
    steps: [
      { order: 1, action: 'revert_to_previous_release', target: 'service-deployment' },
      { order: 2, action: 'verify_error_rate_recovers', target: 'service-deployment' },
    ],
  },
  {
    title: 'Activate Backup Provider',
    slug: 'activate-backup-provider',
    category: 'INFRASTRUCTURE',
    triggerCondition: 'third-party dependency error_rate_percent > 10 for 3m',
    steps: [
      { order: 1, action: 'toggle_feature_flag', target: 'backup-provider-failover' },
      { order: 2, action: 'verify_backup_provider_health', target: 'backup-provider' },
    ],
  },
  {
    title: 'Flush Fraud Model Cache',
    slug: 'flush-fraud-model-cache',
    category: 'APPLICATION',
    triggerCondition: 'error_rate_percent > 5 on fraud-detection for 5m',
    steps: [{ order: 1, action: 'evict_cache', target: 'fraud-model-cache' }],
  },
  {
    title: 'Rotate API Gateway Credentials',
    slug: 'rotate-gateway-credentials',
    category: 'SECURITY',
    triggerCondition: 'suspected credential compromise on api-gateway',
    steps: [
      { order: 1, action: 'rotate_secret', target: 'gateway-signing-key' },
      { order: 2, action: 'invalidate_sessions', target: 'gateway-signing-key' },
    ],
  },
  {
    title: 'Clear Notification Dead-Letter Queue',
    slug: 'clear-notification-dlq',
    category: 'INFRASTRUCTURE',
    triggerCondition: 'queue_depth > 500 on notification-service for 10m',
    steps: [
      { order: 1, action: 'inspect_dead_letter_queue', target: 'notification-dlq' },
      { order: 2, action: 'replay_or_discard', target: 'notification-dlq' },
    ],
  },
  {
    title: 'Reindex Core Banking Read Replica',
    slug: 'reindex-read-replica',
    category: 'DATABASE',
    triggerCondition: 'p99_latency_ms elevated on read-heavy queries',
    steps: [
      { order: 1, action: 'take_replica_out_of_rotation', target: 'read-replica' },
      { order: 2, action: 'reindex', target: 'read-replica' },
      { order: 3, action: 'return_to_rotation', target: 'read-replica' },
    ],
  },
  {
    title: 'Purge Reporting Batch Queue',
    slug: 'purge-reporting-batch-queue',
    category: 'INFRASTRUCTURE',
    triggerCondition: 'queue_depth > 1000 on reporting-batch for 15m',
    steps: [{ order: 1, action: 'drain_and_requeue', target: 'reporting-batch-queue' }],
  },
];

export interface AlertRuleDef {
  serviceKey: string;
  metricName: string;
  comparator: AlertComparator;
  criticalThreshold?: number | undefined;
  highThreshold?: number | undefined;
  mediumThreshold?: number | undefined;
  lowThreshold?: number | undefined;
}

export interface ComplianceProfile {
  complianceScope: string[];
  dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
}

// Which regulatory regimes actually touch each service, and how sensitive
// the data it handles is — two separate axes (a service can be PCI-DSS
// scoped without being the most restrictive classification, and vice
// versa). Grounded in what each service's own function actually is, not
// applied uniformly — api-gateway is pure edge routing and carries no
// compliance scope of its own, while core-banking-api and payments-gateway
// are exactly the systems a real PCI-DSS/SOX audit would ask about first.
export const SERVICE_COMPLIANCE: Record<string, ComplianceProfile> = {
  'api-gateway': { complianceScope: [], dataClassification: 'INTERNAL' },
  'auth-service': { complianceScope: ['SOX'], dataClassification: 'CONFIDENTIAL' },
  'core-banking-api': { complianceScope: ['SOX'], dataClassification: 'RESTRICTED' },
  'payments-gateway': { complianceScope: ['PCI_DSS', 'SOX'], dataClassification: 'RESTRICTED' },
  'card-processing': { complianceScope: ['PCI_DSS'], dataClassification: 'RESTRICTED' },
  'fraud-detection': { complianceScope: ['PCI_DSS'], dataClassification: 'CONFIDENTIAL' },
  'ledger-sync': { complianceScope: ['SOX'], dataClassification: 'CONFIDENTIAL' },
  'kyc-service': { complianceScope: ['AML', 'GDPR'], dataClassification: 'RESTRICTED' },
  'mobile-bff': { complianceScope: ['GDPR'], dataClassification: 'CONFIDENTIAL' },
  'notification-service': { complianceScope: ['GDPR'], dataClassification: 'INTERNAL' },
  'reporting-batch': { complianceScope: ['SOX'], dataClassification: 'CONFIDENTIAL' },
  'audit-ledger-archive': { complianceScope: ['SOX', 'GDPR'], dataClassification: 'RESTRICTED' },
};

// Real incidents accumulate links to every other tool a response actually
// happens in. Keyed by StoryBeat.id — only the six flagship incidents get
// these, so the ones actually used for interview demonstrations read as
// things that happened inside a real tool ecosystem, not a closed
// simulation with nothing pointing outward.
export const FLAGSHIP_EXTERNAL_REFS: Record<
  string,
  { externalTicketUrl: string; statusPageUrl: string }
> = {
  'flagship-db-outage': {
    externalTicketUrl: 'https://bankops.atlassian.net/browse/INFRA-4471',
    statusPageUrl: 'https://status.bankops.internal/incidents/db-connection-pool-exhaustion',
  },
  'flagship-third-party-outage': {
    externalTicketUrl: 'https://bankops.atlassian.net/browse/PAY-2208',
    statusPageUrl: 'https://status.bankops.internal/incidents/correspondent-network-outage',
  },
  'flagship-deployment-failure': {
    externalTicketUrl: 'https://bankops.atlassian.net/browse/CARD-1163',
    statusPageUrl: 'https://status.bankops.internal/incidents/card-processing-elevated-errors',
  },
  'flagship-dependency-failure': {
    externalTicketUrl: 'https://bankops.atlassian.net/browse/ID-3390',
    statusPageUrl: 'https://status.bankops.internal/incidents/auth-service-degradation',
  },
  'flagship-latency-spike': {
    externalTicketUrl: 'https://bankops.atlassian.net/browse/MOBILE-887',
    statusPageUrl: 'https://status.bankops.internal/incidents/mobile-latency-month-end',
  },
  'flagship-memory-leak': {
    externalTicketUrl: 'https://bankops.atlassian.net/browse/PLAT-5502',
    statusPageUrl: 'https://status.bankops.internal/incidents/notification-service-restarts',
  },
};

// Hand-picked, round-number thresholds — the way an ops team actually tunes
// a rule, not a formula derived from the metric's random baseline range.
export const ALERT_RULE_DEFS: AlertRuleDef[] = [
  {
    serviceKey: 'core-banking-api',
    metricName: 'db_connection_pool_used_percent',
    comparator: 'GREATER_THAN',
    criticalThreshold: 95,
    highThreshold: 85,
    mediumThreshold: 70,
    lowThreshold: 55,
  },
  {
    serviceKey: 'core-banking-api',
    metricName: 'error_rate_percent',
    comparator: 'GREATER_THAN',
    criticalThreshold: 10,
    highThreshold: 5,
    mediumThreshold: 2,
    lowThreshold: 1,
  },
  {
    serviceKey: 'payments-gateway',
    metricName: 'error_rate_percent',
    comparator: 'GREATER_THAN',
    criticalThreshold: 8,
    highThreshold: 4,
    mediumThreshold: 2,
    lowThreshold: 1,
  },
  {
    serviceKey: 'card-processing',
    metricName: 'error_rate_percent',
    comparator: 'GREATER_THAN',
    criticalThreshold: 8,
    highThreshold: 4,
    mediumThreshold: 2,
    lowThreshold: 1,
  },
  {
    serviceKey: 'mobile-bff',
    metricName: 'p99_latency_ms',
    comparator: 'GREATER_THAN',
    criticalThreshold: 3000,
    highThreshold: 1500,
    mediumThreshold: 800,
    lowThreshold: 400,
  },
  {
    serviceKey: 'notification-service',
    metricName: 'memory_utilization_percent',
    comparator: 'GREATER_THAN',
    criticalThreshold: 95,
    highThreshold: 88,
    mediumThreshold: 75,
    lowThreshold: 65,
  },
  {
    serviceKey: 'auth-service',
    metricName: 'error_rate_percent',
    comparator: 'GREATER_THAN',
    criticalThreshold: 8,
    highThreshold: 4,
    mediumThreshold: 2,
    lowThreshold: 1,
  },
  {
    serviceKey: 'ledger-sync',
    metricName: 'sync_lag_seconds',
    comparator: 'GREATER_THAN',
    criticalThreshold: 300,
    highThreshold: 180,
    mediumThreshold: 90,
    lowThreshold: 45,
  },
  {
    serviceKey: 'kyc-service',
    metricName: 'queue_depth',
    comparator: 'GREATER_THAN',
    criticalThreshold: 1000,
    highThreshold: 500,
    mediumThreshold: 200,
    lowThreshold: 100,
  },
  {
    serviceKey: 'reporting-batch',
    metricName: 'queue_depth',
    comparator: 'GREATER_THAN',
    criticalThreshold: 2000,
    highThreshold: 1000,
    mediumThreshold: 500,
    lowThreshold: 200,
  },
  {
    serviceKey: 'api-gateway',
    metricName: 'error_rate_percent',
    comparator: 'GREATER_THAN',
    criticalThreshold: 5,
    highThreshold: 2,
    mediumThreshold: 1,
    lowThreshold: 0.5,
  },
  {
    serviceKey: 'fraud-detection',
    metricName: 'p99_latency_ms',
    comparator: 'GREATER_THAN',
    criticalThreshold: 2000,
    highThreshold: 1000,
    mediumThreshold: 500,
    lowThreshold: 250,
  },
];
