export type StatusTone =
  'critical' | 'high' | 'medium' | 'low' | 'healthy' | 'degraded' | 'unknown' | 'info' | 'neutral';

export interface StatusVisual {
  tone: StatusTone;
  label: string;
  pulse?: boolean;
}

const TONE_CLASS: Record<StatusTone, string> = {
  critical: 'text-status-critical bg-status-critical/10 border-status-critical/35',
  high: 'text-status-high bg-status-high/10 border-status-high/35',
  medium: 'text-status-medium bg-status-medium/10 border-status-medium/35',
  low: 'text-status-low bg-status-low/10 border-status-low/35',
  healthy: 'text-status-healthy bg-status-healthy/10 border-status-healthy/35',
  degraded: 'text-status-degraded bg-status-degraded/10 border-status-degraded/35',
  unknown: 'text-status-unknown bg-status-unknown/10 border-status-unknown/35',
  info: 'text-status-info bg-status-info/10 border-status-info/35',
  neutral: 'text-muted bg-raised border-line',
};

const DOT_CLASS: Record<StatusTone, string> = {
  critical: 'bg-status-critical',
  high: 'bg-status-high',
  medium: 'bg-status-medium',
  low: 'bg-status-low',
  healthy: 'bg-status-healthy',
  degraded: 'bg-status-degraded',
  unknown: 'bg-status-unknown',
  info: 'bg-status-info',
  neutral: 'bg-muted',
};

export function toneClass(tone: StatusTone): string {
  return TONE_CLASS[tone];
}

export function dotClass(tone: StatusTone): string {
  return DOT_CLASS[tone];
}

export function severityVisual(value: string | null | undefined): StatusVisual {
  switch (value) {
    case 'P1':
    case 'SEV1':
      return { tone: 'critical', label: value === 'P1' ? 'P1' : 'SEV1' };
    case 'P2':
    case 'SEV2':
      return { tone: 'high', label: value === 'P2' ? 'P2' : 'SEV2' };
    case 'P3':
    case 'SEV3':
      return { tone: 'medium', label: value === 'P3' ? 'P3' : 'SEV3' };
    case 'P4':
    case 'SEV4':
      return { tone: 'low', label: value === 'P4' ? 'P4' : 'SEV4' };
    default:
      return { tone: 'unknown', label: value ?? '—' };
  }
}

export function incidentStatusVisual(value: string | null | undefined): StatusVisual {
  switch (value) {
    case 'OPEN':
      return { tone: 'critical', label: 'OPEN', pulse: true };
    case 'ACKNOWLEDGED':
      return { tone: 'high', label: 'ACK' };
    case 'MITIGATED':
      return { tone: 'info', label: 'MITIGATED' };
    case 'RESOLVED':
      return { tone: 'healthy', label: 'RESOLVED' };
    case 'CLOSED':
      return { tone: 'neutral', label: 'CLOSED' };
    default:
      return { tone: 'unknown', label: value ?? '—' };
  }
}

export function alertStateVisual(value: string | null | undefined): StatusVisual {
  switch (value) {
    case 'FIRING':
      return { tone: 'critical', label: 'FIRING', pulse: true };
    case 'ACKNOWLEDGED':
      return { tone: 'high', label: 'ACK' };
    case 'RESOLVED':
      return { tone: 'healthy', label: 'RESOLVED' };
    default:
      return { tone: 'unknown', label: value ?? '—' };
  }
}

export function serviceStatusVisual(value: string | null | undefined): StatusVisual {
  switch (value) {
    case 'HEALTHY':
      return { tone: 'healthy', label: 'HEALTHY' };
    case 'DEGRADED':
      return { tone: 'degraded', label: 'DEGRADED' };
    case 'CRITICAL':
      return { tone: 'critical', label: 'CRITICAL', pulse: true };
    case 'MAINTENANCE':
      return { tone: 'info', label: 'MAINT' };
    case 'UNKNOWN':
      return { tone: 'unknown', label: 'UNKNOWN' };
    default:
      return { tone: 'unknown', label: value ?? '—' };
  }
}

export function healthVisual(value: string | null | undefined): StatusVisual {
  switch (value) {
    case 'healthy':
    case 'alive':
    case 'ready':
    case 'up':
      return { tone: 'healthy', label: value.toUpperCase() };
    case 'degraded':
      return { tone: 'degraded', label: 'DEGRADED' };
    case 'down':
      return { tone: 'critical', label: 'DOWN', pulse: true };
    case 'unknown':
      return { tone: 'unknown', label: 'UNKNOWN' };
    default:
      return { tone: 'unknown', label: value?.toUpperCase() ?? 'UNKNOWN' };
  }
}

export function tierVisual(value: string | null | undefined): StatusVisual {
  switch (value) {
    case 'TIER_1':
      return { tone: 'critical', label: 'T1' };
    case 'TIER_2':
      return { tone: 'high', label: 'T2' };
    case 'TIER_3':
      return { tone: 'medium', label: 'T3' };
    case 'TIER_4':
      return { tone: 'low', label: 'T4' };
    default:
      return { tone: 'unknown', label: value ?? '—' };
  }
}
