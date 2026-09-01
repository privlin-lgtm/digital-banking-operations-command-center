import { describe, expect, it } from 'vitest';
import { formatDateTime, formatPercent, formatRelative, parsePercent, shortId } from '@/lib/format';

describe('formatDateTime', () => {
  it('renders an em dash for null/undefined/empty input', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('renders an em dash for an unparseable date', () => {
    expect(formatDateTime('not-a-date')).toBe('—');
  });

  it('formats a valid ISO timestamp', () => {
    expect(formatDateTime('2026-03-15T09:30:00Z')).toBe('15/03/2026, 09:30:00');
  });
});

describe('formatRelative', () => {
  it('renders an em dash for null/undefined input', () => {
    expect(formatRelative(null)).toBe('—');
    expect(formatRelative(undefined)).toBe('—');
  });

  it('renders "just now" for a timestamp under 45 seconds old', () => {
    expect(formatRelative(new Date(Date.now() - 10_000).toISOString())).toBe('just now');
  });

  it('renders minutes for a timestamp under an hour old', () => {
    expect(formatRelative(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5m ago');
  });

  it('renders hours for a timestamp under 36 hours old', () => {
    expect(formatRelative(new Date(Date.now() - 3 * 3_600_000).toISOString())).toBe('3h ago');
  });

  it('renders days for anything 36+ hours old', () => {
    expect(formatRelative(new Date(Date.now() - 4 * 86_400_000).toISOString())).toBe('4d ago');
  });
});

describe('shortId', () => {
  it('renders an em dash for null/undefined/empty input', () => {
    expect(shortId(null)).toBe('—');
    expect(shortId('')).toBe('—');
  });

  it('truncates to the first 8 characters', () => {
    expect(shortId('cmthzlzin002ho2bojvnmrd56')).toBe('cmthzlzi');
  });
});

describe('parsePercent', () => {
  it('returns null for null/undefined/empty input', () => {
    expect(parsePercent(null)).toBeNull();
    expect(parsePercent(undefined)).toBeNull();
    expect(parsePercent('')).toBeNull();
  });

  it('returns null for a non-numeric string', () => {
    expect(parsePercent('not-a-number')).toBeNull();
  });

  it('parses a numeric string', () => {
    expect(parsePercent('99.94')).toBe(99.94);
  });

  it('passes through a number unchanged', () => {
    expect(parsePercent(99.94)).toBe(99.94);
  });
});

describe('formatPercent', () => {
  it('renders an em dash for null/undefined/empty input', () => {
    expect(formatPercent(null)).toBe('—');
  });

  it('formats a numeric value to 3 decimal places with a trailing %', () => {
    expect(formatPercent(99.9)).toBe('99.900%');
    expect(formatPercent('99.94123')).toBe('99.941%');
  });
});
