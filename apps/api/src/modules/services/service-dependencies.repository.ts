import { Prisma, type PrismaClient, type ServiceDependency } from '@prisma/client';
import { ConflictError } from '../../lib/errors.js';
import type {
  BlastRadiusNode,
  CreateServiceDependencyInput,
  DependencyWithDependent,
  DependencyWithUpstream,
  ServiceDependenciesRepository,
} from './service-dependencies.types.js';

const serviceSummarySelect = { id: true, name: true, slug: true, status: true } as const;

export class PrismaServiceDependenciesRepository implements ServiceDependenciesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<ServiceDependency | null> {
    return this.prisma.serviceDependency.findUnique({ where: { id } });
  }

  findDependenciesOf(serviceId: string): Promise<DependencyWithUpstream[]> {
    return this.prisma.serviceDependency.findMany({
      where: { serviceId },
      include: { dependsOnService: { select: serviceSummarySelect } },
      orderBy: { createdAt: 'asc' },
    });
  }

  findDependentsOf(serviceId: string): Promise<DependencyWithDependent[]> {
    return this.prisma.serviceDependency.findMany({
      where: { dependsOnServiceId: serviceId },
      include: { service: { select: serviceSummarySelect } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(input: CreateServiceDependencyInput): Promise<ServiceDependency> {
    try {
      return await this.prisma.serviceDependency.create({ data: input });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('This service dependency is already registered');
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.serviceDependency.delete({ where: { id } });
  }

  /**
   * "If this service goes down, what else is affected" — the classic
   * blast-radius question, answered with a recursive CTE instead of N
   * round trips walking the graph one level at a time in application code.
   * `depth < 10` is a cycle safety net (a soft dependency loop is legal
   * data, just not something we want to traverse forever), not a business
   * rule about how many hops "count".
   */
  async getBlastRadius(serviceId: string): Promise<BlastRadiusNode[]> {
    return this.prisma.$queryRaw<BlastRadiusNode[]>`
      WITH RECURSIVE blast AS (
        SELECT s."id" AS "serviceId", s."name", s."slug", 0 AS depth
        FROM "services" s
        WHERE s."id" = ${serviceId}

        UNION ALL

        SELECT dependent."id", dependent."name", dependent."slug", blast.depth + 1
        FROM "service_dependencies" sd
        JOIN "services" dependent ON dependent."id" = sd."serviceId"
        JOIN blast ON blast."serviceId" = sd."dependsOnServiceId"
        WHERE blast.depth < 10
      )
      SELECT DISTINCT ON ("serviceId") "serviceId", "name", "slug", depth
      FROM blast
      WHERE depth > 0
      ORDER BY "serviceId", depth ASC
    `;
  }
}
