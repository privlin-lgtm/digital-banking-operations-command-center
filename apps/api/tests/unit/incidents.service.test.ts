import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../src/lib/errors.js';
import { IncidentsService } from '../../src/modules/incidents/incidents.service.js';
import { FakeAuditLogger } from '../fakes/fake-audit-logger.js';
import {
  FakeIncidentCommentsRepository,
  FakeIncidentRcaGate,
  FakeIncidentTimelineRepository,
  FakeUserLookup,
} from '../fakes/fake-incident-support.js';
import { FakeIncidentsRepository, makeIncident } from '../fakes/fake-incidents-repository.js';
import { FakeServicesRepository, makeService } from '../fakes/fake-services-repository.js';
import { createSilentLogger } from '../fakes/silent-logger.js';

describe('IncidentsService', () => {
  let incidentsRepository: FakeIncidentsRepository;
  let timelineRepository: FakeIncidentTimelineRepository;
  let commentsRepository: FakeIncidentCommentsRepository;
  let servicesRepository: FakeServicesRepository;
  let rcaGate: FakeIncidentRcaGate;
  let userLookup: FakeUserLookup;
  let auditLogger: FakeAuditLogger;
  let service: IncidentsService;

  beforeEach(() => {
    incidentsRepository = new FakeIncidentsRepository();
    timelineRepository = new FakeIncidentTimelineRepository();
    commentsRepository = new FakeIncidentCommentsRepository();
    servicesRepository = new FakeServicesRepository();
    rcaGate = new FakeIncidentRcaGate();
    userLookup = new FakeUserLookup();
    auditLogger = new FakeAuditLogger();
    service = new IncidentsService(
      incidentsRepository,
      timelineRepository,
      commentsRepository,
      servicesRepository,
      rcaGate,
      userLookup,
      auditLogger,
      createSilentLogger(),
    );
  });

  describe('create', () => {
    it('throws NotFoundError when the primary service does not exist', async () => {
      await expect(
        service.create(
          { title: 'Payments down', severity: 'SEV1', primaryServiceId: 'missing' },
          'user-1',
          'RESPONDER',
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('creates an incident and writes a CREATED timeline event', async () => {
      const svc = servicesRepository.seed(makeService());

      const incident = await service.create(
        { title: 'Payments degraded', severity: 'SEV2', primaryServiceId: svc.id },
        'user-1',
        'RESPONDER',
      );

      expect(incident.status).toBe('OPEN');
      const timeline = await timelineRepository.findByIncidentId(incident.id);
      expect(timeline).toHaveLength(1);
      expect(timeline[0]).toMatchObject({ type: 'CREATED', actorId: 'user-1' });
      expect(auditLogger.entries[0]).toMatchObject({ action: 'incident.create' });
    });

    it('rejects a responder assigning the commander to someone else at creation', async () => {
      const svc = servicesRepository.seed(makeService());
      userLookup.activeUserIds.add('other-user');

      await expect(
        service.create(
          { title: 'X', severity: 'SEV3', primaryServiceId: svc.id, commanderId: 'other-user' },
          'user-1',
          'RESPONDER',
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('allows a responder to self-assign at creation, which also acknowledges it', async () => {
      const svc = servicesRepository.seed(makeService());
      userLookup.activeUserIds.add('user-1');

      const incident = await service.create(
        { title: 'X', severity: 'SEV3', primaryServiceId: svc.id, commanderId: 'user-1' },
        'user-1',
        'RESPONDER',
      );

      expect(incident.status).toBe('ACKNOWLEDGED');
      expect(incident.commanderId).toBe('user-1');
    });
  });

  describe('state machine', () => {
    it('rejects resolving an incident that was never acknowledged', async () => {
      const incident = incidentsRepository.seed(makeIncident({ status: 'OPEN' }));
      await expect(
        service.resolve(incident.id, 'Fixed the thing that broke', 'user-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('walks OPEN -> ACKNOWLEDGED -> MITIGATED -> RESOLVED -> CLOSED for a low-severity incident', async () => {
      const incident = incidentsRepository.seed(makeIncident({ status: 'OPEN', severity: 'SEV4' }));

      await service.acknowledge(incident.id, 'user-1');
      await service.mitigate(incident.id, 'user-1');
      const resolved = await service.resolve(incident.id, 'Rolled back the bad deploy', 'user-1');
      expect(resolved.status).toBe('RESOLVED');

      const closed = await service.close(incident.id, 'user-1');
      expect(closed.status).toBe('CLOSED');
      expect(closed.closedAt).not.toBeNull();
    });

    it('rejects reopening an OPEN incident (not a valid transition)', async () => {
      const incident = incidentsRepository.seed(makeIncident({ status: 'OPEN' }));
      await expect(service.reopen(incident.id, 'test', 'user-1')).rejects.toThrow(ValidationError);
    });

    it('allows reopening a CLOSED incident', async () => {
      const incident = incidentsRepository.seed(makeIncident({ status: 'CLOSED' }));
      const reopened = await service.reopen(incident.id, 'Recurred in production', 'user-1');
      expect(reopened.status).toBe('OPEN');
    });
  });

  describe('close() RCA gate', () => {
    it('blocks closing a SEV1 incident without an approved RCA', async () => {
      const incident = incidentsRepository.seed(
        makeIncident({ status: 'RESOLVED', severity: 'SEV1' }),
      );
      await expect(service.close(incident.id, 'user-1')).rejects.toThrow(ConflictError);
    });

    it('allows closing a SEV1 incident once the RCA is approved', async () => {
      const incident = incidentsRepository.seed(
        makeIncident({ status: 'RESOLVED', severity: 'SEV1' }),
      );
      rcaGate.approvedIncidentIds.add(incident.id);

      const closed = await service.close(incident.id, 'user-1');
      expect(closed.status).toBe('CLOSED');
    });

    it('allows closing a SEV4 incident with no RCA at all', async () => {
      const incident = incidentsRepository.seed(
        makeIncident({ status: 'RESOLVED', severity: 'SEV4' }),
      );
      const closed = await service.close(incident.id, 'user-1');
      expect(closed.status).toBe('CLOSED');
    });
  });

  describe('assign', () => {
    it('lets a responder claim an incident for themselves', async () => {
      const incident = incidentsRepository.seed(makeIncident());
      userLookup.activeUserIds.add('user-1');

      const updated = await service.assign(incident.id, 'user-1', 'user-1', 'RESPONDER');
      expect(updated.commanderId).toBe('user-1');
    });

    it('blocks a responder from assigning someone else', async () => {
      const incident = incidentsRepository.seed(makeIncident());
      userLookup.activeUserIds.add('other-user');

      await expect(
        service.assign(incident.id, 'other-user', 'user-1', 'RESPONDER'),
      ).rejects.toThrow(ValidationError);
    });

    it('lets a commander assign any active user', async () => {
      const incident = incidentsRepository.seed(makeIncident());
      userLookup.activeUserIds.add('some-responder');

      const updated = await service.assign(
        incident.id,
        'some-responder',
        'commander-1',
        'COMMANDER',
      );
      expect(updated.commanderId).toBe('some-responder');
    });

    it('rejects assigning an unknown or inactive user', async () => {
      const incident = incidentsRepository.seed(makeIncident());
      await expect(
        service.assign(incident.id, 'ghost', 'commander-1', 'COMMANDER'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getTimeline', () => {
    it('merges system events and comments in chronological order', async () => {
      const incident = incidentsRepository.seed(makeIncident());
      await timelineRepository.append({
        incidentId: incident.id,
        type: 'CREATED',
        message: 'Opened',
        actorId: 'user-1',
      });
      await service.addComment(incident.id, 'user-2', 'Looking into it now');

      const feed = await service.getTimeline(incident.id);
      expect(feed.map((item) => item.kind)).toEqual(['EVENT', 'COMMENT']);
    });
  });
});
