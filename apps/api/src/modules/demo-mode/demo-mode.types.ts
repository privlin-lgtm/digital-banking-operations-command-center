import type { UserRole } from '@bankops/shared';
import type {
  Alert,
  DemoIntensity,
  DemoModeState,
  DemoScenario,
  RcaRootCauseCategory,
} from '@prisma/client';

export interface EnableDemoModeInput {
  scenario?: DemoScenario | undefined;
  intensity?: DemoIntensity | undefined;
  autoLoop?: boolean | undefined;
}

export interface DemoModeRepository {
  get(): Promise<DemoModeState>;
  update(patch: Partial<DemoModeState>): Promise<DemoModeState>;
}

/** The only slice of ServicesRepository this module needs — same narrow-port pattern as FailureSimulator's ServiceLookup. */
export interface ServiceLookup {
  findBySlug(slug: string): Promise<{ id: string } | null>;
}

/** The only slice of ServiceHealthService needed: write a sample through the normal metrics path. */
export interface MetricRecorder {
  recordMetric(
    serviceId: string,
    input: { metricName: string; value: number; unit: string },
  ): Promise<unknown>;
}

/** The only slice of AlertsService needed: react to a sample exactly as a real agent's metric write would. */
export interface MetricEvaluator {
  evaluateMetric(
    serviceId: string,
    metricName: string,
    value: number,
    actorId: string,
    actorRole: UserRole,
  ): Promise<Alert | null>;
}

/** The only slice of IncidentsService this module drives directly — creation and remediation are already automatic inside MetricEvaluator. */
export interface IncidentLifecycle {
  acknowledge(id: string, actorId: string): Promise<unknown>;
  mitigate(id: string, actorId: string): Promise<unknown>;
  resolve(id: string, resolutionSummary: string, actorId: string): Promise<unknown>;
}

/** The only slice of SlaTrackingService needed: force a recompute once a demo incident has changed a service's downtime for the current window. */
export interface SlaRollupTrigger {
  runRollup(actorId: string): Promise<unknown>;
}

/** The only slice of RcaService needed to run a demo incident's RCA through its full real lifecycle. */
export interface RcaLifecycle {
  create(input: {
    incidentId: string;
    rootCause: string;
    rootCauseCategory: RcaRootCauseCategory;
    contributingFactors?: string | undefined;
    authoredById: string;
  }): Promise<{ id: string; authoredById: string }>;
  submitForReview(id: string, actorId: string): Promise<unknown>;
  approve(id: string, reviewedById: string, actorId: string): Promise<unknown>;
}

/** A second, distinct human account to satisfy the RCA module's four-eyes rule — see RcaService.approve. */
export interface ReviewerLookup {
  findReviewerCandidate(excludeUserId: string): Promise<{ id: string } | null>;
}
