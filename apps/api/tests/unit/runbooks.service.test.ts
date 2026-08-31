import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../src/lib/errors.js';
import { RunbooksService } from '../../src/modules/runbooks/runbooks.service.js';
import { FakeAuditLogger } from '../fakes/fake-audit-logger.js';
import {
  FakeIncidentLookup,
  FakeRunbooksRepository,
  makeRunbook,
} from '../fakes/fake-runbooks-repository.js';
import { createSilentLogger } from '../fakes/silent-logger.js';

describe('RunbooksService', () => {
  let repository: FakeRunbooksRepository;
  let incidentLookup: FakeIncidentLookup;
  let auditLogger: FakeAuditLogger;
  let service: RunbooksService;

  beforeEach(() => {
    repository = new FakeRunbooksRepository();
    incidentLookup = new FakeIncidentLookup();
    auditLogger = new FakeAuditLogger();
    service = new RunbooksService(repository, incidentLookup, auditLogger, createSilentLogger());
  });

  describe('create', () => {
    it('rejects a duplicate slug', async () => {
      repository.seed(makeRunbook({ slug: 'restart-api' }));
      await expect(
        service.create({
          title: 'Restart API',
          slug: 'restart-api',
          category: 'APPLICATION',
          triggerCondition: 'API is down',
          steps: [{ order: 1, action: 'restart' }],
          createdById: 'user-1',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('creates a runbook and records an audit entry', async () => {
      const runbook = await service.create({
        title: 'Failover the primary DB',
        slug: 'failover-primary-db',
        category: 'DATABASE',
        triggerCondition: 'primary unreachable',
        steps: [{ order: 1, action: 'promote_replica' }],
        createdById: 'user-1',
      });

      expect(runbook.category).toBe('DATABASE');
      expect(auditLogger.entries[0]).toMatchObject({
        action: 'runbook.create',
        entityId: runbook.id,
      });
    });
  });

  describe('update', () => {
    it('bumps the version on every edit', async () => {
      const runbook = repository.seed(makeRunbook({ version: 1 }));
      const updated = await service.update(runbook.id, { title: 'New title' }, 'user-1');
      expect(updated.version).toBe(2);
      expect(updated.title).toBe('New title');
    });

    it('throws NotFoundError for an unknown runbook', async () => {
      await expect(service.update('missing', { title: 'X' }, 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('linkToIncident', () => {
    it('throws NotFoundError when the incident does not exist', async () => {
      const runbook = repository.seed(makeRunbook());
      await expect(
        service.linkToIncident(runbook.id, 'missing-incident', 'user-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when the runbook does not exist', async () => {
      incidentLookup.existingIncidentIds.add('inc-1');
      await expect(service.linkToIncident('missing-runbook', 'inc-1', 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it("links with the runbook's current version, in PENDING state", async () => {
      const runbook = repository.seed(makeRunbook({ version: 3 }));
      incidentLookup.existingIncidentIds.add('inc-1');

      const link = await service.linkToIncident(runbook.id, 'inc-1', 'user-1');

      expect(link).toMatchObject({
        incidentId: 'inc-1',
        runbookId: runbook.id,
        runbookVersion: 3,
        outcome: 'PENDING',
      });
      expect(auditLogger.entries[0]).toMatchObject({ action: 'runbook.link' });
    });
  });

  describe('recordOutcome', () => {
    it('throws NotFoundError for an unknown link', async () => {
      await expect(service.recordOutcome('missing', 'SUCCESS', 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('rejects recording an outcome twice', async () => {
      const runbook = repository.seed(makeRunbook());
      incidentLookup.existingIncidentIds.add('inc-1');
      const link = await service.linkToIncident(runbook.id, 'inc-1', 'user-1');

      await service.recordOutcome(link.id, 'SUCCESS', 'user-1');
      await expect(service.recordOutcome(link.id, 'FAILURE', 'user-1')).rejects.toThrow(
        ValidationError,
      );
    });

    it('records the outcome and audits it', async () => {
      const runbook = repository.seed(makeRunbook());
      incidentLookup.existingIncidentIds.add('inc-1');
      const link = await service.linkToIncident(runbook.id, 'inc-1', 'user-1');

      const updated = await service.recordOutcome(link.id, 'PARTIAL', 'user-1');
      expect(updated.outcome).toBe('PARTIAL');
      expect(auditLogger.entries.at(-1)).toMatchObject({ action: 'runbook.execution_recorded' });
    });
  });
});
