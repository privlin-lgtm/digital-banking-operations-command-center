import type { PrismaClient, Service, ServiceStatus } from '@prisma/client';
import type {
  CreateServiceInput,
  ListServicesFilter,
  ServicesRepository,
  UpdateServiceInput,
} from './services.types.js';

export class PrismaServicesRepository implements ServicesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findMany(filter: ListServicesFilter): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: {
        ...(filter.tier ? { tier: filter.tier } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string): Promise<Service | null> {
    return this.prisma.service.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Service | null> {
    return this.prisma.service.findUnique({ where: { slug } });
  }

  create(input: CreateServiceInput): Promise<Service> {
    return this.prisma.service.create({ data: input });
  }

  update(id: string, input: UpdateServiceInput): Promise<Service> {
    return this.prisma.service.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.tier !== undefined ? { tier: input.tier } : {}),
        ...(input.ownerTeam !== undefined ? { ownerTeam: input.ownerTeam } : {}),
      },
    });
  }

  updateStatus(id: string, status: ServiceStatus): Promise<Service> {
    return this.prisma.service.update({ where: { id }, data: { status } });
  }

  archive(id: string): Promise<Service> {
    return this.prisma.service.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  countDependents(id: string): Promise<number> {
    return this.prisma.serviceDependency.count({ where: { dependsOnServiceId: id } });
  }

  countOpenIncidents(id: string): Promise<number> {
    return this.prisma.incident.count({
      where: { primaryServiceId: id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
    });
  }
}
