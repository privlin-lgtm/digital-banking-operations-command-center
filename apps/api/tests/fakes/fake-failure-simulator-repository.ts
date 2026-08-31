import type { UserRole } from '@bankops/shared';
import type { FailureScenario, FailureSimulation } from '@prisma/client';
import type {
  CreateSimulationInput,
  FailureSimulationsRepository,
  ListSimulationsFilter,
  MetricEvaluator,
  MetricRecorder,
  ServiceLookup,
} from '../../src/modules/failure-simulator/failure-simulator.types.js';

let simulationCounter = 0;

export function makeSimulation(overrides: Partial<FailureSimulation> = {}): FailureSimulation {
  simulationCounter += 1;
  return {
    id: overrides.id ?? `sim-${simulationCounter}`,
    serviceId: overrides.serviceId ?? 'svc-1',
    scenario: overrides.scenario ?? ('CPU_SPIKE' as FailureScenario),
    tickCount: overrides.tickCount ?? 0,
    startedById: overrides.startedById ?? 'user-1',
    startedAt: overrides.startedAt ?? new Date(),
    stoppedAt: overrides.stoppedAt ?? null,
  };
}

export class FakeFailureSimulationsRepository implements FailureSimulationsRepository {
  private readonly rows = new Map<string, FailureSimulation>();

  seed(simulation: FailureSimulation): FailureSimulation {
    this.rows.set(simulation.id, simulation);
    return simulation;
  }

  async findById(id: string): Promise<FailureSimulation | null> {
    return this.rows.get(id) ?? null;
  }

  async findActiveByService(serviceId: string): Promise<FailureSimulation | null> {
    return (
      [...this.rows.values()].find((s) => s.serviceId === serviceId && s.stoppedAt === null) ?? null
    );
  }

  async findMany(filter: ListSimulationsFilter): Promise<FailureSimulation[]> {
    return [...this.rows.values()].filter(
      (s) =>
        (!filter.serviceId || s.serviceId === filter.serviceId) &&
        (!filter.activeOnly || s.stoppedAt === null),
    );
  }

  async listActive(): Promise<FailureSimulation[]> {
    return [...this.rows.values()].filter((s) => s.stoppedAt === null);
  }

  async create(input: CreateSimulationInput): Promise<FailureSimulation> {
    const simulation = makeSimulation(input);
    this.rows.set(simulation.id, simulation);
    return simulation;
  }

  async stop(id: string): Promise<FailureSimulation> {
    const existing = this.mustGet(id);
    const updated = { ...existing, stoppedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async incrementTick(id: string): Promise<FailureSimulation> {
    const existing = this.mustGet(id);
    const updated = { ...existing, tickCount: existing.tickCount + 1 };
    this.rows.set(id, updated);
    return updated;
  }

  private mustGet(id: string): FailureSimulation {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`FakeFailureSimulationsRepository: "${id}" not found`);
    return existing;
  }
}

export class FakeServiceLookup implements ServiceLookup {
  private readonly ids = new Set<string>();

  seed(id: string): void {
    this.ids.add(id);
  }

  async findById(id: string): Promise<{ id: string } | null> {
    return this.ids.has(id) ? { id } : null;
  }
}

export class FakeMetricRecorder implements MetricRecorder {
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

export class FakeMetricEvaluator implements MetricEvaluator {
  readonly calls: Array<{ serviceId: string; metricName: string; value: number }> = [];

  async evaluateMetric(
    serviceId: string,
    metricName: string,
    value: number,
    _actorId: string,
    _actorRole: UserRole,
  ): Promise<unknown> {
    this.calls.push({ serviceId, metricName, value });
    return null;
  }
}
