import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IncidentsPage from '@/app/(dashboard)/incidents/page';
import type { IncidentRecord } from '@/lib/types';

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => '/incidents',
}));

function makeIncident(overrides: Partial<IncidentRecord> = {}): IncidentRecord {
  return {
    id: 'incident-1',
    title: 'Elevated error rate on Core Banking API',
    severity: 'SEV1',
    status: 'OPEN',
    primaryServiceId: 'svc-core-banking',
    commanderId: null,
    openedAt: new Date().toISOString(),
    acknowledgedAt: null,
    resolvedAt: null,
    closedAt: null,
    ...overrides,
  };
}

describe('IncidentsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders fetched incidents once loading completes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve({ data: [makeIncident()] }),
      }),
    );

    render(<IncidentsPage />);

    expect(await screen.findByText('Elevated error rate on Core Banking API')).toBeInTheDocument();
    expect(screen.getByText('SEV1')).toBeInTheDocument();
    expect(screen.getByText('OPEN')).toBeInTheDocument();
  });

  it('shows the empty state when no incidents match the query', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve({ data: [] }) }),
    );

    render(<IncidentsPage />);

    expect(await screen.findByText('No incidents match this query')).toBeInTheDocument();
  });

  it('shows an error state with a working retry on a failed fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 500,
        ok: false,
        json: () => Promise.resolve({ error: { code: 'REQUEST_FAILED', message: 'Server error' } }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve({ data: [makeIncident({ title: 'Recovered after retry' })] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<IncidentsPage />);

    expect(await screen.findByText('Unable to load incidents')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Recovered after retry')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refetches with the selected status in the query string when the filter changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ data: [makeIncident()] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<IncidentsPage />);
    await screen.findByText('Elevated error rate on Core Banking API');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'ACKNOWLEDGED' } });

    await waitFor(() => {
      const lastCallUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCallUrl).toContain('status=ACKNOWLEDGED');
    });
  });
});
