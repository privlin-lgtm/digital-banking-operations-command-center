import type { DependencyType } from '@prisma/client';
import type { AuditLogger } from '../audit/audit-logger.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import type { ServiceDependenciesRepository } from './service-dependencies.types.js';
import type { ServicesRepository } from './services.types.js';

export class ServiceDependencyService {
  constructor(
    private readonly dependenciesRepository: ServiceDependenciesRepository,
    private readonly servicesRepository: ServicesRepository,
    private readonly auditLogger: AuditLogger,
  ) {}

  async listDependencies(serviceId: string) {
    await this.assertServiceExists(serviceId);
    return this.dependenciesRepository.findDependenciesOf(serviceId);
  }

  async listDependents(serviceId: string) {
    await this.assertServiceExists(serviceId);
    return this.dependenciesRepository.findDependentsOf(serviceId);
  }

  async getBlastRadius(serviceId: string) {
    await this.assertServiceExists(serviceId);
    return this.dependenciesRepository.getBlastRadius(serviceId);
  }

  async addDependency(
    serviceId: string,
    input: { dependsOnServiceId: string; dependencyType: DependencyType },
    actorId: string,
  ) {
    if (serviceId === input.dependsOnServiceId) {
      throw new ValidationError('A service cannot depend on itself');
    }

    await this.assertServiceExists(serviceId, 'Service');
    await this.assertServiceExists(input.dependsOnServiceId, 'Upstream service');

    const dependency = await this.dependenciesRepository.create({
      serviceId,
      dependsOnServiceId: input.dependsOnServiceId,
      dependencyType: input.dependencyType,
    });

    await this.auditLogger.record({
      actorId,
      action: 'service.dependency.add',
      entityType: 'ServiceDependency',
      entityId: dependency.id,
      metadata: {
        serviceId,
        dependsOnServiceId: input.dependsOnServiceId,
        dependencyType: input.dependencyType,
      },
    });

    return dependency;
  }

  async removeDependency(serviceId: string, dependencyId: string, actorId: string): Promise<void> {
    const dependency = await this.dependenciesRepository.findById(dependencyId);
    if (!dependency || dependency.serviceId !== serviceId) {
      throw new NotFoundError(`Dependency "${dependencyId}" not found for service "${serviceId}"`);
    }

    await this.dependenciesRepository.delete(dependencyId);
    await this.auditLogger.record({
      actorId,
      action: 'service.dependency.remove',
      entityType: 'ServiceDependency',
      entityId: dependencyId,
      metadata: { serviceId },
    });
  }

  private async assertServiceExists(id: string, label = 'Service'): Promise<void> {
    const exists = await this.servicesRepository.findById(id);
    if (!exists) {
      throw new NotFoundError(`${label} "${id}" not found`);
    }
  }
}
