import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, toQuery, unwrapData } from '@/lib/api';

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed body on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve({ data: { id: 'incident-1' } }),
      }),
    );

    await expect(apiFetch('/incidents/incident-1')).resolves.toEqual({
      data: { id: 'incident-1' },
    });
  });

  it('returns undefined for a 204 No Content response without reading the body', async () => {
    const json = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 204, ok: true, json }));

    await expect(apiFetch('/incidents/incident-1')).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it('throws a NETWORK_ERROR ApiError when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(apiFetch('/incidents')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });

  it('throws an ApiError built from the response body on a non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 404,
        ok: false,
        json: () =>
          Promise.resolve({ error: { code: 'NOT_FOUND', message: 'Incident not found' } }),
      }),
    );

    await expect(apiFetch('/incidents/missing')).rejects.toEqual(
      new ApiError(404, 'NOT_FOUND', 'Incident not found'),
    );
  });

  it('falls back to generic error fields when the error body is missing or unparseable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 500, ok: false, json: () => Promise.reject() }),
    );

    await expect(apiFetch('/incidents')).rejects.toMatchObject({
      status: 500,
      code: 'REQUEST_FAILED',
    });
  });
});

describe('unwrapData', () => {
  it('extracts the data field from an envelope', () => {
    expect(unwrapData({ data: [1, 2, 3] })).toEqual([1, 2, 3]);
  });
});

describe('toQuery', () => {
  it('serializes only defined, non-empty params', () => {
    expect(toQuery({ severity: 'SEV1', status: undefined, activeOnly: null, q: '' })).toBe(
      '?severity=SEV1',
    );
  });

  it('stringifies booleans', () => {
    expect(toQuery({ activeOnly: true })).toBe('?activeOnly=true');
  });

  it('returns an empty string when every param is filtered out', () => {
    expect(toQuery({ a: undefined, b: null, c: '' })).toBe('');
  });
});
