import type { Service, ServiceStatus } from '@prisma/client';
import type {
  CreateServiceInput,
  ListServicesFilter,
  ServicesRepository,
  UpdateServiceInput,
} from '../../src/modules/services/services.types.js';

let idCounter = 0;

export function makeService(overrides: Partial<Service> = {}): Service {
  idCounter += 1;
  const now = new Date();
  return {
    id: overrides.id ?? `svc-${idCounter}`,
    name: overrides.name ?? 'Test Service',
    slug: overrides.slug ?? `test-service-${idCounter}`,
    tier: overrides.tier ?? 'TIER_2',
    ownerTeam: overrides.ownerTeam ?? 'Team',
    status: overrides.status ?? 'UNKNOWN',
    archivedAt: overrides.archivedAt ?? null,
    complianceScope: overrides.complianceScope ?? [],
    dataClassification: overrides.dataClassification ?? 'INTERNAL',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

/**
 * An in-memory stand-in for `ServicesRepository`. This is the whole point
 * of depending on an interface instead of Prisma directly: the service
 * layer's business rules (conflict checks, delete guards) can be exercised
 * with plain objects and no database.
 */
export class FakeServicesRepository implements ServicesRepository {
  private readonly rows = new Map<string, Service>();

  /** Test-only knobs for the archive guard. */
  dependentsCount = 0;
  openIncidentsCount = 0;

  seed(service: Service): Service {
    this.rows.set(service.id, service);
    return service;
  }

  async findMany(filter: ListServicesFilter): Promise<Service[]> {
    return [...this.rows.values()].filter(
      (service) =>
        (!filter.tier || service.tier === filter.tier) &&
        (!filter.status || service.status === filter.status) &&
        (filter.includeArchived || service.archivedAt === null),
    );
  }

  async findById(id: string): Promise<Service | null> {
    return this.rows.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Service | null> {
    return [...this.rows.values()].find((service) => service.slug === slug) ?? null;
  }

  async create(input: CreateServiceInput): Promise<Service> {
    const service = makeService(input);
    this.rows.set(service.id, service);
    return service;
  }

  async update(id: string, input: UpdateServiceInput): Promise<Service> {
    const existing = this.rows.get(id);
    if (!existing) {
      throw new Error(`FakeServicesRepository: "${id}" not found`);
    }
    const updated: Service = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.tier !== undefined ? { tier: input.tier } : {}),
      ...(input.ownerTeam !== undefined ? { ownerTeam: input.ownerTeam } : {}),
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async updateStatus(id: string, status: ServiceStatus): Promise<Service> {
    const existing = this.rows.get(id);
    if (!existing) {
      throw new Error(`FakeServicesRepository: "${id}" not found`);
    }
    const updated: Service = { ...existing, status };
    this.rows.set(id, updated);
    return updated;
  }

  async archive(id: string): Promise<Service> {
    const existing = this.rows.get(id);
    if (!existing) {
      throw new Error(`FakeServicesRepository: "${id}" not found`);
    }
    const updated: Service = { ...existing, archivedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async countDependents(): Promise<number> {
    return this.dependentsCount;
  }

  async countOpenIncidents(): Promise<number> {
    return this.openIncidentsCount;
  }
}
