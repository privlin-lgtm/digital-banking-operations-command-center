import { beforeEach, describe, expect, it } from 'vitest';
import { EscalationEngine } from '../../src/modules/incidents/escalation-engine.js';
import { IncidentEscalationService } from '../../src/modules/incidents/incident-escalation.service.js';
import { FakeAuditLogger } from '../fakes/fake-audit-logger.js';
import { FakeIncidentTimelineRepository } from '../fakes/fake-incident-support.js';
import { FakeIncidentNotifier } from '../fakes/fake-incident-notifier.js';
import { FakeIncidentsRepository, makeIncident } from '../fakes/fake-incidents-repository.js';
import { createSilentLogger } from '../fakes/silent-logger.js';

describe('IncidentEscalationService.runSweep', () => {
  let incidentsRepository: FakeIncidentsRepository;
  let timelineRepository: FakeIncidentTimelineRepository;
  let notifier: FakeIncidentNotifier;
  let auditLogger: FakeAuditLogger;
  let escalationService: IncidentEscalationService;

  beforeEach(() => {
    incidentsRepository = new FakeIncidentsRepository();
    timelineRepository = new FakeIncidentTimelineRepository();
    notifier = new FakeIncidentNotifier();
    auditLogger = new FakeAuditLogger();
    escalationService = new IncidentEscalationService(
      incidentsRepository,
      timelineRepository,
      notifier,
      auditLogger,
      new EscalationEngine(),
      createSilentLogger(),
    );
  });

  const longAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

  it('escalates a breached incident and leaves a compliant one untouched', async () => {
    const breached = incidentsRepository.seed(
      makeIncident({ id: 'breached', severity: 'SEV1', status: 'OPEN', openedAt: longAgo(20) }), // P1 ack SLA is 5m
    );
    const withinSla = incidentsRepository.seed(
      makeIncident({ id: 'ok', severity: 'SEV3', status: 'OPEN', openedAt: longAgo(5) }), // P3 ack SLA is 60m
    );

    const result = await escalationService.runSweep('system-actor');

    expect(result).toEqual({ checked: 2, escalated: 1, maxLevelReached: 0 });

    const updatedBreached = await incidentsRepository.findById(breached.id);
    expect(updatedBreached?.escalationLevel).toBe(1);
    expect(notifier.calls).toHaveLength(1);
    expect(notifier.calls[0]?.incidentId).toBe(breached.id);
    expect(auditLogger.entries).toHaveLength(1);
    expect(auditLogger.entries[0]).toMatchObject({
      action: 'incident.escalate',
      entityId: breached.id,
    });

    const timeline = await timelineRepository.findByIncidentId(breached.id);
    expect(timeline[0]).toMatchObject({ type: 'ESCALATED', actorId: null });

    const updatedOk = await incidentsRepository.findById(withinSla.id);
    expect(updatedOk?.escalationLevel).toBe(0);
  });

  it('ignores incidents that are already resolved or closed', async () => {
    incidentsRepository.seed(
      makeIncident({ id: 'done', severity: 'SEV1', status: 'RESOLVED', openedAt: longAgo(500) }),
    );

    const result = await escalationService.runSweep('system-actor');

    expect(result.checked).toBe(0); // findActiveForEscalation excludes RESOLVED/CLOSED
    expect(notifier.calls).toHaveLength(0);
  });

  it('counts an exhausted chain as maxLevelReached, not escalated', async () => {
    incidentsRepository.seed(
      makeIncident({
        id: 'exhausted',
        severity: 'SEV4', // P4's chain has 1 role
        status: 'OPEN',
        openedAt: longAgo(1000),
        escalationLevel: 1,
        lastEscalatedAt: longAgo(600),
      }),
    );

    const result = await escalationService.runSweep('system-actor');

    expect(result).toEqual({ checked: 1, escalated: 0, maxLevelReached: 1 });
    expect(notifier.calls).toHaveLength(0);
  });

  it('previewDecision returns the engine result without mutating anything', async () => {
    const incident = incidentsRepository.seed(
      makeIncident({ severity: 'SEV1', status: 'OPEN', openedAt: longAgo(20) }),
    );

    const decision = await escalationService.previewDecision(incident.id);

    expect(decision.action).toBe('ESCALATE');
    const stillUnchanged = await incidentsRepository.findById(incident.id);
    expect(stillUnchanged?.escalationLevel).toBe(0);
  });
});
