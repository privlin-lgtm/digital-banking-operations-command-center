'use client';

import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSelect } from '@/components/ui/FilterBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useResource } from '@/hooks/useResource';
import { toQuery } from '@/lib/api';
import { formatDateTime, formatRelative, shortId } from '@/lib/format';
import { incidentStatusVisual, severityVisual } from '@/lib/status';
import type { Envelope, IncidentRecord } from '@/lib/types';

const COLUMNS: Column<IncidentRecord>[] = [
  {
    key: 'id',
    header: 'ID',
    className: 'w-20 font-mono text-2xs text-muted',
    render: (row) => <span title={row.id}>{shortId(row.id)}</span>,
  },
  {
    key: 'sev',
    header: 'Sev',
    className: 'w-14',
    render: (row) => <StatusBadge {...severityVisual(row.severity)} />,
  },
  {
    key: 'status',
    header: 'Status',
    className: 'w-24',
    render: (row) => <StatusBadge {...incidentStatusVisual(row.status)} />,
  },
  {
    key: 'title',
    header: 'Title',
    render: (row) => <span className="text-bright">{row.title}</span>,
  },
  {
    key: 'service',
    header: 'Service',
    className: 'w-28 font-mono text-2xs',
    render: (row) => shortId(row.primaryServiceId),
  },
  {
    key: 'commander',
    header: 'Commander',
    className: 'w-28 font-mono text-2xs',
    render: (row) => shortId(row.commanderId),
  },
  {
    key: 'opened',
    header: 'Opened',
    className: 'w-28 font-mono text-2xs',
    align: 'right' as const,
    render: (row) => (
      <span title={formatDateTime(row.openedAt)}>{formatRelative(row.openedAt)}</span>
    ),
  },
];

export default function IncidentsPage() {
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const path = useMemo(() => `/incidents${toQuery({ status, severity })}`, [status, severity]);
  const { data, error, loading, reload } = useResource<Envelope<IncidentRecord[]>>(path);
  const rows = data?.data ?? [];

  return (
    <PageShell
      title="Incidents"
      subtitle="Command queue for production incidents"
      flush
      toolbar={
        <FilterBar trailing={loading ? 'Loading' : `${rows.length} rows`}>
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: 'All' },
              { value: 'OPEN', label: 'Open' },
              { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
              { value: 'MITIGATED', label: 'Mitigated' },
              { value: 'RESOLVED', label: 'Resolved' },
              { value: 'CLOSED', label: 'Closed' },
            ]}
          />
          <FilterSelect
            label="Severity"
            value={severity}
            onChange={setSeverity}
            options={[
              { value: '', label: 'All' },
              { value: 'P1', label: 'P1' },
              { value: 'P2', label: 'P2' },
              { value: 'P3', label: 'P3' },
              { value: 'P4', label: 'P4' },
            ]}
          />
        </FilterBar>
      }
    >
      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowKey={(row) => row.id}
        getRowAccent={(row) => severityVisual(row.severity).tone}
        frameless
        loading={loading}
        error={error}
        errorTitle="Unable to load incidents"
        emptyTitle="No incidents match this query"
        emptyDescription="Adjust status or severity, or wait for the next page from on-call."
        emptyHint="GET /incidents"
        onRetry={reload}
      />
    </PageShell>
  );
}
