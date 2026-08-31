import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../src/lib/errors.js';
import { RcaReportGenerator } from '../../src/modules/rca/rca-report-generator.js';
import { RcaService } from '../../src/modules/rca/rca.service.js';
import { FakeAuditLogger } from '../fakes/fake-audit-logger.js';
import {
  FakeIncidentContextReader,
  FakeIncidentLookup,
  FakeRcaReportsRepository,
  makeRcaReport,
} from '../fakes/fake-rca-repository.js';
import { createSilentLogger } from '../fakes/silent-logger.js';

describe('RcaService', () => {
  let repository: FakeRcaReportsRepository;
  let incidentLookup: FakeIncidentLookup;
  let contextReader: FakeIncidentContextReader;
  let auditLogger: FakeAuditLogger;
  let service: RcaService;

  beforeEach(() => {
    repository = new FakeRcaReportsRepository();
    incidentLookup = new FakeIncidentLookup();
    contextReader = new FakeIncidentContextReader();
    auditLogger = new FakeAuditLogger();
    service = new RcaService(
      repository,
      incidentLookup,
      contextReader,
      new RcaReportGenerator(),
      auditLogger,
      createSilentLogger(),
    );
  });

  describe('create', () => {
    it('throws NotFoundError when the incident does not exist', async () => {
      await expect(
        service.create({
          incidentId: 'missing',
          rootCause: 'x'.repeat(20),
          rootCauseCategory: 'CODE_DEFECT',
          authoredById: 'user-1',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('rejects a second RCA report for the same incident', async () => {
      incidentLookup.existingIncidentIds.add('inc-1');
      repository.seed(makeRcaReport({ incidentId: 'inc-1' }));

      await expect(
        service.create({
          incidentId: 'inc-1',
          rootCause: 'x'.repeat(20),
          rootCauseCategory: 'CODE_DEFECT',
          authoredById: 'user-1',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('creates the report and audits it', async () => {
      incidentLookup.existingIncidentIds.add('inc-1');
      const report = await service.create({
        incidentId: 'inc-1',
        rootCause: 'Deploy shrank the connection pool',
        rootCauseCategory: 'CONFIGURATION_CHANGE',
        authoredById: 'user-1',
      });

      expect(report.status).toBe('DRAFT');
      expect(auditLogger.entries[0]).toMatchObject({ action: 'rca.create', entityId: 'inc-1' });
    });
  });

  describe('update', () => {
    it('blocks editing an approved report', async () => {
      const report = repository.seed(makeRcaReport({ status: 'APPROVED' }));
      await expect(
        service.update(report.id, { rootCause: 'x'.repeat(20) }, 'user-1'),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('submitForReview', () => {
    it('only allows submitting a DRAFT report', async () => {
      const report = repository.seed(makeRcaReport({ status: 'IN_REVIEW' }));
      await expect(service.submitForReview(report.id, 'user-1')).rejects.toThrow(ValidationError);
    });

    it('moves a draft into review', async () => {
      const report = repository.seed(makeRcaReport({ status: 'DRAFT' }));
      const updated = await service.submitForReview(report.id, 'user-1');
      expect(updated.status).toBe('IN_REVIEW');
    });
  });

  describe('approve (four-eyes)', () => {
    it('rejects approval by the report author', async () => {
      const report = repository.seed(
        makeRcaReport({ status: 'IN_REVIEW', authoredById: 'author-1' }),
      );
      await expect(service.approve(report.id, 'author-1', 'author-1')).rejects.toThrow(
        ValidationError,
      );
    });

    it('rejects approving a report that is not IN_REVIEW', async () => {
      const report = repository.seed(makeRcaReport({ status: 'DRAFT', authoredById: 'author-1' }));
      await expect(service.approve(report.id, 'reviewer-1', 'reviewer-1')).rejects.toThrow(
        ValidationError,
      );
    });

    it('approves when the reviewer differs from the author', async () => {
      const report = repository.seed(
        makeRcaReport({ status: 'IN_REVIEW', authoredById: 'author-1' }),
      );
      const updated = await service.approve(report.id, 'reviewer-1', 'reviewer-1');
      expect(updated.status).toBe('APPROVED');
      expect(updated.reviewedById).toBe('reviewer-1');
      expect(updated.publishedAt).not.toBeNull();
    });
  });

  describe('corrective actions', () => {
    it('adds a corrective action and lists it back', async () => {
      const report = repository.seed(makeRcaReport());
      await service.addCorrectiveAction(
        {
          rcaReportId: report.id,
          type: 'PREVENTIVE',
          description: 'Add an alert',
          ownerId: 'owner-1',
        },
        'user-1',
      );

      const actions = await service.getCorrectiveActions(report.id);
      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({ type: 'PREVENTIVE', isComplete: false });
    });

    it('marks an action complete', async () => {
      const report = repository.seed(makeRcaReport());
      const action = await service.addCorrectiveAction(
        {
          rcaReportId: report.id,
          type: 'CORRECTIVE',
          description: 'Roll back',
          ownerId: 'owner-1',
        },
        'user-1',
      );

      const updated = await service.markActionComplete(action.id, 'user-1');
      expect(updated.isComplete).toBe(true);
    });

    it('throws NotFoundError for an unknown action', async () => {
      await expect(service.markActionComplete('missing', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('generateReport', () => {
    it('assembles context, timeline, and actions into a markdown document', async () => {
      const report = repository.seed(
        makeRcaReport({
          incidentId: 'inc-1',
          authoredById: 'author-1',
          reviewedById: 'reviewer-1',
          status: 'APPROVED',
        }),
      );
      await service.addCorrectiveAction(
        {
          rcaReportId: report.id,
          type: 'CORRECTIVE',
          description: 'Roll back the deploy',
          ownerId: 'author-1',
        },
        'author-1',
      );

      contextReader.contexts.set('inc-1', {
        id: 'inc-1',
        title: 'Payments degraded',
        severity: 'SEV1',
        status: 'CLOSED',
        primaryServiceName: 'Payments Gateway',
        commanderName: 'Dana Cohen',
        openedAt: new Date('2026-01-01T00:00:00Z'),
        acknowledgedAt: new Date('2026-01-01T00:05:00Z'),
        resolvedAt: new Date('2026-01-01T01:00:00Z'),
        closedAt: new Date('2026-01-02T00:00:00Z'),
      });
      contextReader.timelines.set('inc-1', [
        {
          at: new Date('2026-01-01T00:00:00Z'),
          actorName: null,
          summary: '[CREATED] Incident opened',
        },
      ]);
      contextReader.userNames.set('author-1', 'Yossi Levi');
      contextReader.userNames.set('reviewer-1', 'Dana Cohen');

      const { markdown } = await service.generateReport('inc-1');

      expect(markdown).toContain('Payments degraded');
      expect(markdown).toContain('Roll back the deploy');
      expect(markdown).toContain('Authored by **Yossi Levi**');
      expect(markdown).toContain('Reviewed and approved by **Dana Cohen**');
    });

    it('throws NotFoundError when the incident has no RCA report', async () => {
      await expect(service.generateReport('missing')).rejects.toThrow(NotFoundError);
    });
  });
});
