import type { Service, ServiceStatus, ServiceTier } from '@prisma/client';

export interface CreateServiceInput {
  name: string;
  slug: string;
  tier: ServiceTier;
  ownerTeam: string;
}

export interface UpdateServiceInput {
  name?: string | undefined;
  slug?: string | undefined;
  tier?: ServiceTier | undefined;
  ownerTeam?: string | undefined;
}

export interface ListServicesFilter {
  tier?: ServiceTier | undefined;
  status?: ServiceStatus | undefined;
  /** Archived services are excluded from every list by default — pass true to see them (e.g. an "archived catalog" admin view). */
  includeArchived?: boolean | undefined;
}

/**
 * The service layer depends on this interface, not on Prisma directly.
 * That's the whole payoff of the DI pattern here: `ServicesService` can be
 * unit-tested with a hand-written fake that implements this contract, with
 * no database, no Prisma mocking library, and no network involved.
 */
export interface ServicesRepository {
  findMany(filter: ListServicesFilter): Promise<Service[]>;
  findById(id: string): Promise<Service | null>;
  findBySlug(slug: string): Promise<Service | null>;
  create(input: CreateServiceInput): Promise<Service>;
  update(id: string, input: UpdateServiceInput): Promise<Service>;
  updateStatus(id: string, status: ServiceStatus): Promise<Service>;
  /** Soft-archive, not delete — see the schema note on Service.archivedAt for why. */
  archive(id: string): Promise<Service>;
  /** Number of OTHER services that declare a dependency on this one. */
  countDependents(id: string): Promise<number>;
  /** Number of incidents against this service that aren't resolved/closed yet. */
  countOpenIncidents(id: string): Promise<number>;
}
