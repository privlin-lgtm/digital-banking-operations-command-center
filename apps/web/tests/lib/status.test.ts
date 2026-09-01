import { describe, expect, it } from 'vitest';
import {
  alertStateVisual,
  healthVisual,
  incidentStatusVisual,
  serviceStatusVisual,
  severityVisual,
  tierVisual,
} from '@/lib/status';

// These mappings are the only thing standing between a real Severity/Status
// enum value and what color an operator sees — a swapped case here silently
// mis-represents an incident as less (or more) severe than it is.
describe('severityVisual', () => {
  it.each([
    ['SEV1', 'critical'],
    ['SEV2', 'high'],
    ['SEV3', 'medium'],
    ['SEV4', 'low'],
  ] as const)('maps %s to the %s tone', (severity, tone) => {
    expect(severityVisual(severity).tone).toBe(tone);
  });

  it('falls back to unknown for an unrecognized value', () => {
    expect(severityVisual('SEV99').tone).toBe('unknown');
    expect(severityVisual(null).label).toBe('—');
  });
});

describe('incidentStatusVisual', () => {
  it.each([
    ['OPEN', 'critical'],
    ['ACKNOWLEDGED', 'high'],
    ['MITIGATED', 'info'],
    ['RESOLVED', 'healthy'],
    ['CLOSED', 'neutral'],
  ] as const)('maps %s to the %s tone', (status, tone) => {
    expect(incidentStatusVisual(status).tone).toBe(tone);
  });
});

describe('alertStateVisual', () => {
  it('maps FIRING to critical, not healthy', () => {
    expect(alertStateVisual('FIRING').tone).toBe('critical');
  });

  it('maps RESOLVED to healthy', () => {
    expect(alertStateVisual('RESOLVED').tone).toBe('healthy');
  });
});

describe('serviceStatusVisual', () => {
  it.each([
    ['HEALTHY', 'healthy'],
    ['DEGRADED', 'degraded'],
    ['CRITICAL', 'critical'],
    ['MAINTENANCE', 'info'],
  ] as const)('maps %s to the %s tone', (status, tone) => {
    expect(serviceStatusVisual(status).tone).toBe(tone);
  });
});

describe('healthVisual', () => {
  it('treats healthy/alive/ready/up as the healthy tone', () => {
    for (const value of ['healthy', 'alive', 'ready', 'up']) {
      expect(healthVisual(value).tone).toBe('healthy');
    }
  });

  it('treats down as critical, not degraded', () => {
    expect(healthVisual('down').tone).toBe('critical');
  });
});

describe('tierVisual', () => {
  it('labels TIER_1 distinctly from the rest', () => {
    expect(tierVisual('TIER_1')).toEqual({ tone: 'info', label: 'T1' });
    expect(tierVisual('TIER_2').tone).toBe('neutral');
  });
});
