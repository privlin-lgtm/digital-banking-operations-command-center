import type { UserRole } from '@bankops/shared';
import type { FailureSimulation } from '@prisma/client';
import type { Logger } from 'pino';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { AuditLogger } from '../audit/audit-logger.js';
import type { FailureScenarioGenerator } from './scenario-generator.js';
import type {
  FailureSimulationsRepository,
  ListSimulationsFilter,
  MetricEvaluator,
  MetricRecorder,
  ServiceLookup,
  StartSimulationInput,
} from './failure-simulator.types.js';

/**
 * Chaos-engineering harness: start/stop fault injection against a service,
 * and drive the recurring tick that turns "running" into synthetic
 * telemetry. Deliberately has no alert- or incident-creation logic of its
 * own — it feeds the exact same record-then-evaluate path a real metrics
 * agent uses (see `tick`), so AlertsService reacting to a simulated
 * database outage is not a special case, it's the same code path a real
 * one would hit.
 */
export class FailureSimulatorService {
  constructor(
    private readonly repository: FailureSimulationsRepository,
    private readonly servicesLookup: ServiceLookup,
    private readonly metricRecorder: MetricRecorder,
    private readonly metricEvaluator: MetricEvaluator,
    private readonly generator: FailureScenarioGenerator,
    private readonly auditLogger: AuditLogger,
    private readonly logger: Logger,
  ) {}

  list(filter: ListSimulationsFilter): Promise<FailureSimulation[]> {
    return this.repository.findMany(filter);
  }

  async getById(id: string): Promise<FailureSimulation> {
    const simulation = await this.repository.findById(id);
    if (!simulation) {
      throw new NotFoundError(`Failure simulation "${id}" not found`);
    }
    return simulation;
  }

  async start(input: StartSimulationInput, actorId: string): Promise<FailureSimulation> {
    const service = await this.servicesLookup.findById(input.serviceId);
    if (!service) {
      throw new NotFoundError(`Service "${input.serviceId}" not found`);
    }

    const active = await this.repository.findActiveByService(input.serviceId);
    if (active) {
      throw new ConflictError(
        `Service already has a running simulation (${active.scenario}) — stop it before starting another`,
      );
    }

    const simulation = await this.repository.create({
      serviceId: input.serviceId,
      scenario: input.scenario,
      startedById: actorId,
    });
    this.logger.warn(
      { simulationId: simulation.id, serviceId: input.serviceId, scenario: input.scenario },
      'Failure simulation started',
    );
    await this.auditLogger.record({
      actorId,
      action: 'failure_simulation.start',
      entityType: 'Service',
      entityId: input.serviceId,
      metadata: { scenario: input.scenario, simulationId: simulation.id },
    });
    return simulation;
  }

  async stop(id: string, actorId: string): Promise<FailureSimulation> {
    const simulation = await this.getById(id);
    if (simulation.stoppedAt) {
      throw new ValidationError('Simulation is already stopped');
    }

    const stopped = await this.repository.stop(id);
    this.logger.info({ simulationId: id }, 'Failure simulation stopped');
    await this.auditLogger.record({
      actorId,
      action: 'failure_simulation.stop',
      entityType: 'Service',
      entityId: simulation.serviceId,
      metadata: { scenario: simulation.scenario, simulationId: id },
    });
    return stopped;
  }

  /**
   * Called once per scheduler tick (see server.ts) for every currently
   * running simulation. Each tick: generate this scenario's next samples,
   * record and evaluate each one — in that order, matching what
   * ServiceHealthController does for a real incoming sample — then
   * advance tickCount so a ramping scenario (e.g. MEMORY_LEAK) actually
   * ramps between ticks instead of resampling the same starting value.
   */
  async tick(actorId: string, actorRole: UserRole): Promise<void> {
    const active = await this.repository.listActive();
    for (const simulation of active) {
      const samples = this.generator.generate(simulation.scenario, simulation.tickCount);
      for (const sample of samples) {
        await this.metricRecorder.recordMetric(simulation.serviceId, {
          metricName: sample.metricName,
          value: sample.value,
          unit: sample.unit,
        });
        await this.metricEvaluator.evaluateMetric(
          simulation.serviceId,
          sample.metricName,
          sample.value,
          actorId,
          actorRole,
        );
      }
      await this.repository.incrementTick(simulation.id);
    }
  }
}
