const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return DATE_TIME.format(date);
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const deltaMs = Date.now() - date.getTime();
  const abs = Math.abs(deltaMs);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);

  if (abs < 45_000) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 36) {
    return `${hours}h ago`;
  }
  return `${days}d ago`;
}

export function shortId(id: string | null | undefined): string {
  if (!id) {
    return '—';
  }
  return id.slice(0, 8);
}

export function parsePercent(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

export function formatPercent(value: string | number | null | undefined): string {
  const numeric = parsePercent(value);
  if (numeric === null) {
    return value === null || value === undefined || value === '' ? '—' : String(value);
  }
  return `${numeric.toFixed(3)}%`;
}
