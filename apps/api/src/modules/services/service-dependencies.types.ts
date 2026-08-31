import type { DependencyType, Service, ServiceDependency } from '@prisma/client';

export interface CreateServiceDependencyInput {
  serviceId: string;
  dependsOnServiceId: string;
  dependencyType: DependencyType;
}

export type ServiceSummary = Pick<Service, 'id' | 'name' | 'slug' | 'status'>;

export interface DependencyWithUpstream extends ServiceDependency {
  dependsOnService: ServiceSummary;
}

export interface DependencyWithDependent extends ServiceDependency {
  service: ServiceSummary;
}

/** One node in a blast-radius traversal: a service reachable from the
 * queried one by following "depends on" edges backwards N hops. */
export interface BlastRadiusNode {
  serviceId: string;
  name: string;
  slug: string;
  depth: number;
}

export interface ServiceDependenciesRepository {
  findById(id: string): Promise<ServiceDependency | null>;
  /** Services that the given service depends on. */
  findDependenciesOf(serviceId: string): Promise<DependencyWithUpstream[]>;
  /** Services that depend on the given service (the reverse edge). */
  findDependentsOf(serviceId: string): Promise<DependencyWithDependent[]>;
  create(input: CreateServiceDependencyInput): Promise<ServiceDependency>;
  delete(id: string): Promise<void>;
  /** Transitive closure of `findDependentsOf`, breadth by breadth. */
  getBlastRadius(serviceId: string): Promise<BlastRadiusNode[]>;
}
