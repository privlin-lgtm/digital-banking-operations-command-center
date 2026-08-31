import type { FailureSimulation, PrismaClient } from '@prisma/client';
import type {
  CreateSimulationInput,
  FailureSimulationsRepository,
  ListSimulationsFilter,
} from './failure-simulator.types.js';

export class PrismaFailureSimulationsRepository implements FailureSimulationsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<FailureSimulation | null> {
    return this.prisma.failureSimulation.findUnique({ where: { id } });
  }

  findActiveByService(serviceId: string): Promise<FailureSimulation | null> {
    return this.prisma.failureSimulation.findFirst({ where: { serviceId, stoppedAt: null } });
  }

  findMany(filter: ListSimulationsFilter): Promise<FailureSimulation[]> {
    return this.prisma.failureSimulation.findMany({
      where: {
        ...(filter.serviceId ? { serviceId: filter.serviceId } : {}),
        ...(filter.activeOnly ? { stoppedAt: null } : {}),
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  listActive(): Promise<FailureSimulation[]> {
    return this.prisma.failureSimulation.findMany({ where: { stoppedAt: null } });
  }

  create(input: CreateSimulationInput): Promise<FailureSimulation> {
    return this.prisma.failureSimulation.create({
      data: {
        serviceId: input.serviceId,
        scenario: input.scenario,
        startedById: input.startedById,
      },
    });
  }

  stop(id: string): Promise<FailureSimulation> {
    return this.prisma.failureSimulation.update({
      where: { id },
      data: { stoppedAt: new Date() },
    });
  }

  incrementTick(id: string): Promise<FailureSimulation> {
    return this.prisma.failureSimulation.update({
      where: { id },
      data: { tickCount: { increment: 1 } },
    });
  }
}
