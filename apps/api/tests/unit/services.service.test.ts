import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../src/lib/errors.js';
import { ServicesService } from '../../src/modules/services/services.service.js';
import { FakeAuditLogger } from '../fakes/fake-audit-logger.js';
import { FakeServicesRepository, makeService } from '../fakes/fake-services-repository.js';
import { createSilentLogger } from '../fakes/silent-logger.js';

describe('ServicesService', () => {
  let repository: FakeServicesRepository;
  let auditLogger: FakeAuditLogger;
  let service: ServicesService;

  beforeEach(() => {
    repository = new FakeServicesRepository();
    auditLogger = new FakeAuditLogger();
    service = new ServicesService(repository, auditLogger, createSilentLogger());
  });

  describe('register', () => {
    it('creates a service and records an audit entry', async () => {
      const created = await service.register(
        {
          name: 'Payments Gateway',
          slug: 'payments-gateway',
          tier: 'TIER_1',
          ownerTeam: 'Payments',
        },
        'user-1',
      );

      expect(created.slug).toBe('payments-gateway');
      expect(await repository.findBySlug('payments-gateway')).not.toBeNull();
      expect(auditLogger.entries).toHaveLength(1);
      expect(auditLogger.entries[0]).toMatchObject({
        actorId: 'user-1',
        action: 'service.create',
        entityType: 'Service',
        entityId: created.id,
      });
    });

    it('rejects a duplicate slug with ConflictError', async () => {
      repository.seed(makeService({ slug: 'payments-gateway' }));

      await expect(
        service.register(
          {
            name: 'Payments Gateway 2',
            slug: 'payments-gateway',
            tier: 'TIER_1',
            ownerTeam: 'Payments',
          },
          'user-1',
        ),
      ).rejects.toThrow(ConflictError);
      expect(auditLogger.entries).toHaveLength(0);
    });
  });

  describe('getById', () => {
    it('throws NotFoundError for an unknown id', async () => {
      await expect(service.getById('missing')).rejects.toThrow(NotFoundError);
    });

    it('returns the service when it exists', async () => {
      const seeded = repository.seed(makeService());
      await expect(service.getById(seeded.id)).resolves.toEqual(seeded);
    });
  });

  describe('update', () => {
    it('updates fields and records an audit entry', async () => {
      const seeded = repository.seed(makeService({ ownerTeam: 'Old Team' }));

      const updated = await service.update(seeded.id, { ownerTeam: 'New Team' }, 'user-1');

      expect(updated.ownerTeam).toBe('New Team');
      expect(auditLogger.entries[0]).toMatchObject({
        action: 'service.update',
        entityId: seeded.id,
      });
    });

    it('allows re-saving the same slug on the same service', async () => {
      const seeded = repository.seed(makeService({ slug: 'core-banking-api' }));

      await expect(
        service.update(
          seeded.id,
          { slug: 'core-banking-api', ownerTeam: 'Core Platform' },
          'user-1',
        ),
      ).resolves.toMatchObject({ slug: 'core-banking-api' });
    });

    it('rejects a slug already used by a different service', async () => {
      repository.seed(makeService({ slug: 'taken-slug' }));
      const target = repository.seed(makeService({ slug: 'free-slug' }));

      await expect(service.update(target.id, { slug: 'taken-slug' }, 'user-1')).rejects.toThrow(
        ConflictError,
      );
    });

    it('throws NotFoundError when the service does not exist', async () => {
      await expect(service.update('missing', { ownerTeam: 'X' }, 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('updateStatus', () => {
    it('updates status and audits the transition', async () => {
      const seeded = repository.seed(makeService({ status: 'HEALTHY' }));

      const updated = await service.updateStatus(seeded.id, 'CRITICAL', 'user-1');

      expect(updated.status).toBe('CRITICAL');
      expect(auditLogger.entries[0]).toMatchObject({
        action: 'service.status_change',
        entityId: seeded.id,
        metadata: { from: 'HEALTHY', to: 'CRITICAL' },
      });
    });
  });

  describe('remove', () => {
    it('deletes a service with no dependents and no open incidents', async () => {
      const seeded = repository.seed(makeService());

      await service.remove(seeded.id, 'user-1');

      expect(await repository.findById(seeded.id)).toBeNull();
      expect(auditLogger.entries[0]).toMatchObject({
        action: 'service.delete',
        entityId: seeded.id,
      });
    });

    it('refuses to delete a service other services depend on', async () => {
      const seeded = repository.seed(makeService());
      repository.dependentsCount = 2;

      await expect(service.remove(seeded.id, 'user-1')).rejects.toThrow(ConflictError);
      expect(await repository.findById(seeded.id)).not.toBeNull();
    });

    it('refuses to delete a service with open incidents', async () => {
      const seeded = repository.seed(makeService());
      repository.openIncidentsCount = 1;

      await expect(service.remove(seeded.id, 'user-1')).rejects.toThrow(ConflictError);
      expect(await repository.findById(seeded.id)).not.toBeNull();
    });

    it('throws NotFoundError for an unknown id', async () => {
      await expect(service.remove('missing', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });
});
