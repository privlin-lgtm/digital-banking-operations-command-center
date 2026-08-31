import type { ServiceDependency } from '@prisma/client';
import type {
  BlastRadiusNode,
  CreateServiceDependencyInput,
  DependencyWithDependent,
  DependencyWithUpstream,
  ServiceDependenciesRepository,
} from '../../src/modules/services/service-dependencies.types.js';

let idCounter = 0;

export class FakeServiceDependenciesRepository implements ServiceDependenciesRepository {
  private readonly rows = new Map<string, ServiceDependency>();
  blastRadius: BlastRadiusNode[] = [];

  async findById(id: string): Promise<ServiceDependency | null> {
    return this.rows.get(id) ?? null;
  }

  async findDependenciesOf(serviceId: string): Promise<DependencyWithUpstream[]> {
    return [...this.rows.values()]
      .filter((row) => row.serviceId === serviceId)
      .map((row) => ({
        ...row,
        dependsOnService: {
          id: row.dependsOnServiceId,
          name: 'Upstream',
          slug: 'upstream',
          status: 'HEALTHY',
        },
      }));
  }

  async findDependentsOf(serviceId: string): Promise<DependencyWithDependent[]> {
    return [...this.rows.values()]
      .filter((row) => row.dependsOnServiceId === serviceId)
      .map((row) => ({
        ...row,
        service: { id: row.serviceId, name: 'Dependent', slug: 'dependent', status: 'HEALTHY' },
      }));
  }

  async create(input: CreateServiceDependencyInput): Promise<ServiceDependency> {
    idCounter += 1;
    const row: ServiceDependency = {
      id: `dep-${idCounter}`,
      serviceId: input.serviceId,
      dependsOnServiceId: input.dependsOnServiceId,
      dependencyType: input.dependencyType,
      createdAt: new Date(),
    };
    this.rows.set(row.id, row);
    return row;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async getBlastRadius(): Promise<BlastRadiusNode[]> {
    return this.blastRadius;
  }
}
