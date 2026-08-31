import type { UserRole } from '@bankops/shared';
import type { FailureScenario, FailureSimulation } from '@prisma/client';

export interface StartSimulationInput {
  serviceId: string;
  scenario: FailureScenario;
}

export interface ListSimulationsFilter {
  serviceId?: string | undefined;
  activeOnly?: boolean | undefined;
}

export interface CreateSimulationInput {
  serviceId: string;
  scenario: FailureScenario;
  startedById: string;
}

export interface FailureSimulationsRepository {
  findById(id: string): Promise<FailureSimulation | null>;
  /** The partial-uniqueness this module enforces at the app layer: at most one running (stoppedAt: null) simulation per service. */
  findActiveByService(serviceId: string): Promise<FailureSimulation | null>;
  findMany(filter: ListSimulationsFilter): Promise<FailureSimulation[]>;
  /** Every currently-running row, across all services — what the scheduler tick iterates. */
  listActive(): Promise<FailureSimulation[]>;
  create(input: CreateSimulationInput): Promise<FailureSimulation>;
  stop(id: string): Promise<FailureSimulation>;
  incrementTick(id: string): Promise<FailureSimulation>;
}

/** The only slice of ServicesRepository this module needs — same narrow-port pattern as AlertsService's IncidentCreator. */
export interface ServiceLookup {
  findById(id: string): Promise<{ id: string } | null>;
}

/** The only slice of ServiceHealthService needed: write a sample through the normal metrics path, no read APIs. */
export interface MetricRecorder {
  recordMetric(
    serviceId: string,
    input: { metricName: string; value: number; unit: string },
  ): Promise<unknown>;
}

/** The only slice of AlertsService needed: react to a sample exactly as it would to one from a real agent. */
export interface MetricEvaluator {
  evaluateMetric(
    serviceId: string,
    metricName: string,
    value: number,
    actorId: string,
    actorRole: UserRole,
  ): Promise<unknown>;
}
