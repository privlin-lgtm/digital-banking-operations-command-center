export type StatusTone =
  'critical' | 'high' | 'medium' | 'low' | 'healthy' | 'degraded' | 'unknown' | 'info' | 'neutral';

export interface StatusVisual {
  tone: StatusTone;
  label: string;
}

const TONE_CLASS: Record<StatusTone, string> = {
  critical: 'text-status-critical',
  high: 'text-status-high',
  medium: 'text-status-medium',
  low: 'text-status-low',
  healthy: 'text-status-healthy',
  degraded: 'text-status-degraded',
  unknown: 'text-status-unknown',
  info: 'text-status-info',
  neutral: 'text-muted',
};

const SWATCH_CLASS: Record<StatusTone, string> = {
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

const ACCENT_BORDER: Record<StatusTone, string> = {
  critical: 'border-l-status-critical',
  high: 'border-l-status-high',
  medium: 'border-l-status-medium',
  low: 'border-l-status-low',
  healthy: 'border-l-status-healthy',
  degraded: 'border-l-status-degraded',
  unknown: 'border-l-status-unknown',
  info: 'border-l-status-info',
  neutral: 'border-l-line-strong',
};

export function toneClass(tone: StatusTone): string {
  return TONE_CLASS[tone];
}

export function swatchClass(tone: StatusTone): string {
  return SWATCH_CLASS[tone];
}

export function fillClass(tone: StatusTone): string {
  return SWATCH_CLASS[tone];
}

export function accentBorderClass(tone: StatusTone): string {
  return ACCENT_BORDER[tone];
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
      return { tone: 'critical', label: 'OPEN' };
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
      return { tone: 'critical', label: 'FIRING' };
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
      return { tone: 'critical', label: 'CRITICAL' };
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
      return { tone: 'critical', label: 'DOWN' };
    case 'unknown':
      return { tone: 'unknown', label: 'UNKNOWN' };
    default:
      return { tone: 'unknown', label: value?.toUpperCase() ?? 'UNKNOWN' };
  }
}

export function tierVisual(value: string | null | undefined): StatusVisual {
  switch (value) {
    case 'TIER_1':
      return { tone: 'info', label: 'T1' };
    case 'TIER_2':
      return { tone: 'neutral', label: 'T2' };
    case 'TIER_3':
      return { tone: 'neutral', label: 'T3' };
    case 'TIER_4':
      return { tone: 'neutral', label: 'T4' };
    default:
      return { tone: 'unknown', label: value ?? '—' };
  }
}
