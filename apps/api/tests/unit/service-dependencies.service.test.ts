import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../../src/lib/errors.js';
import { ServiceDependencyService } from '../../src/modules/services/service-dependencies.service.js';
import { FakeAuditLogger } from '../fakes/fake-audit-logger.js';
import { FakeServiceDependenciesRepository } from '../fakes/fake-service-dependencies-repository.js';
import { FakeServicesRepository, makeService } from '../fakes/fake-services-repository.js';

describe('ServiceDependencyService', () => {
  let dependenciesRepository: FakeServiceDependenciesRepository;
  let servicesRepository: FakeServicesRepository;
  let auditLogger: FakeAuditLogger;
  let service: ServiceDependencyService;

  beforeEach(() => {
    dependenciesRepository = new FakeServiceDependenciesRepository();
    servicesRepository = new FakeServicesRepository();
    auditLogger = new FakeAuditLogger();
    service = new ServiceDependencyService(dependenciesRepository, servicesRepository, auditLogger);
  });

  describe('addDependency', () => {
    it('rejects a service depending on itself', async () => {
      const svc = servicesRepository.seed(makeService());

      await expect(
        service.addDependency(
          svc.id,
          { dependsOnServiceId: svc.id, dependencyType: 'HARD' },
          'user-1',
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects when the dependent service does not exist', async () => {
      const upstream = servicesRepository.seed(makeService());

      await expect(
        service.addDependency(
          'missing',
          { dependsOnServiceId: upstream.id, dependencyType: 'HARD' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('rejects when the upstream service does not exist', async () => {
      const dependent = servicesRepository.seed(makeService());

      await expect(
        service.addDependency(
          dependent.id,
          { dependsOnServiceId: 'missing', dependencyType: 'HARD' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('creates the dependency and records an audit entry', async () => {
      const dependent = servicesRepository.seed(makeService());
      const upstream = servicesRepository.seed(makeService());

      const dependency = await service.addDependency(
        dependent.id,
        { dependsOnServiceId: upstream.id, dependencyType: 'SOFT' },
        'user-1',
      );

      expect(dependency).toMatchObject({
        serviceId: dependent.id,
        dependsOnServiceId: upstream.id,
      });
      expect(auditLogger.entries[0]).toMatchObject({
        action: 'service.dependency.add',
        entityId: dependency.id,
      });
    });
  });

  describe('removeDependency', () => {
    it('throws NotFoundError when the dependency does not belong to the given service', async () => {
      const dependent = servicesRepository.seed(makeService());
      const upstream = servicesRepository.seed(makeService());
      const other = servicesRepository.seed(makeService());

      const dependency = await service.addDependency(
        dependent.id,
        { dependsOnServiceId: upstream.id, dependencyType: 'HARD' },
        'user-1',
      );

      await expect(service.removeDependency(other.id, dependency.id, 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('deletes the dependency and records an audit entry', async () => {
      const dependent = servicesRepository.seed(makeService());
      const upstream = servicesRepository.seed(makeService());
      const dependency = await service.addDependency(
        dependent.id,
        { dependsOnServiceId: upstream.id, dependencyType: 'HARD' },
        'user-1',
      );

      await service.removeDependency(dependent.id, dependency.id, 'user-1');

      expect(await dependenciesRepository.findById(dependency.id)).toBeNull();
      expect(auditLogger.entries.at(-1)).toMatchObject({
        action: 'service.dependency.remove',
        entityId: dependency.id,
      });
    });
  });

  describe('listDependencies / listDependents / getBlastRadius', () => {
    it('throws NotFoundError for an unknown service', async () => {
      await expect(service.listDependencies('missing')).rejects.toThrow(NotFoundError);
      await expect(service.listDependents('missing')).rejects.toThrow(NotFoundError);
      await expect(service.getBlastRadius('missing')).rejects.toThrow(NotFoundError);
    });

    it('delegates to the repository once existence is confirmed', async () => {
      const svc = servicesRepository.seed(makeService());
      dependenciesRepository.blastRadius = [
        { serviceId: 'downstream-1', name: 'Downstream', slug: 'downstream', depth: 1 },
      ];

      await expect(service.getBlastRadius(svc.id)).resolves.toEqual(
        dependenciesRepository.blastRadius,
      );
    });
  });
});
