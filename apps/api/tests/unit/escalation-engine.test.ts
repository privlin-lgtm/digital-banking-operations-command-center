import { describe, expect, it } from 'vitest';
import {
  EscalationEngine,
  type EscalationInput,
} from '../../src/modules/incidents/escalation-engine.js';

const NOW = new Date('2026-01-01T12:00:00Z');

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
}

function baseIncident(overrides: Partial<EscalationInput> = {}): EscalationInput {
  return {
    severity: 'SEV2', // P2: 15m ack SLA, 30m escalation window, 2-role chain
    status: 'OPEN',
    openedAt: minutesAgo(0),
    acknowledgedAt: null,
    escalationLevel: 0,
    lastEscalatedAt: null,
    ...overrides,
  };
}

describe('EscalationEngine', () => {
  const engine = new EscalationEngine();

  it('does nothing for a terminal incident regardless of age', () => {
    const incident = baseIncident({ status: 'RESOLVED', openedAt: minutesAgo(500) });
    const decision = engine.evaluate(incident, NOW);
    expect(decision.action).toBe('NONE');
  });

  it('does nothing while still inside the ack SLA', () => {
    const incident = baseIncident({ openedAt: minutesAgo(10) }); // P2 ack SLA is 15m
    const decision = engine.evaluate(incident, NOW);
    expect(decision.action).toBe('NONE');
    expect(decision.ackSlaBreached).toBe(false);
  });

  it('does nothing if already acknowledged, even long after opening', () => {
    const incident = baseIncident({ openedAt: minutesAgo(500), acknowledgedAt: minutesAgo(400) });
    const decision = engine.evaluate(incident, NOW);
    expect(decision.action).toBe('NONE');
    expect(decision.ackSlaBreached).toBe(false);
  });

  it('escalates once the ack SLA is breached and never acknowledged', () => {
    const incident = baseIncident({ openedAt: minutesAgo(16) }); // just past the 15m SLA
    const decision = engine.evaluate(incident, NOW);
    expect(decision.action).toBe('ESCALATE');
    expect(decision.toLevel).toBe(1);
    expect(decision.toRole).toBe('RESPONDER');
    expect(decision.ackSlaBreached).toBe(true);
  });

  it('does not escalate again before the next escalation window elapses', () => {
    const incident = baseIncident({
      openedAt: minutesAgo(40),
      escalationLevel: 1,
      lastEscalatedAt: minutesAgo(10), // P2 escalates every 30m — only 10 have passed
    });
    const decision = engine.evaluate(incident, NOW);
    expect(decision.action).toBe('NONE');
  });

  it('escalates to the next tier once the escalation window elapses again', () => {
    const incident = baseIncident({
      openedAt: minutesAgo(50),
      escalationLevel: 1,
      lastEscalatedAt: minutesAgo(31), // just past the 30m window
    });
    const decision = engine.evaluate(incident, NOW);
    expect(decision.action).toBe('ESCALATE');
    expect(decision.toLevel).toBe(2);
    expect(decision.toRole).toBe('COMMANDER'); // P2's chain is [RESPONDER, COMMANDER]
  });

  it('reports MAX_LEVEL_REACHED once the chain is exhausted', () => {
    const incident = baseIncident({
      openedAt: minutesAgo(100),
      escalationLevel: 2, // P2's chain has only 2 roles
      lastEscalatedAt: minutesAgo(31),
    });
    const decision = engine.evaluate(incident, NOW);
    expect(decision.action).toBe('MAX_LEVEL_REACHED');
  });

  it('uses a longer ack SLA and a 3-role chain for P1/SEV1', () => {
    const incident = baseIncident({ severity: 'SEV1', openedAt: minutesAgo(6) }); // P1 ack SLA is 5m
    const decision = engine.evaluate(incident, NOW);
    expect(decision.action).toBe('ESCALATE');
    expect(decision.toRole).toBe('RESPONDER');
  });

  it('flags a resolve-SLA breach independently of escalation state', () => {
    const incident = baseIncident({
      severity: 'SEV2',
      openedAt: minutesAgo(300), // P2 resolve SLA is 240m
      acknowledgedAt: minutesAgo(299),
    });
    const decision = engine.evaluate(incident, NOW);
    expect(decision.resolveSlaBreached).toBe(true);
    // Acknowledged, so no escalation is triggered by the ack SLA path.
    expect(decision.action).toBe('NONE');
  });
});
