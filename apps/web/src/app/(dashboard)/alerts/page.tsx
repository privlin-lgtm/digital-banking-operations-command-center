'use client';

import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSelect } from '@/components/ui/FilterBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useResource } from '@/hooks/useResource';
import { toQuery } from '@/lib/api';
import { formatDateTime, formatRelative, shortId } from '@/lib/format';
import { alertStateVisual, severityVisual } from '@/lib/status';
import type { AlertRecord, Envelope } from '@/lib/types';

const COLUMNS: Column<AlertRecord>[] = [
  {
    key: 'id',
    header: 'ID',
    className: 'w-20 font-mono text-2xs text-muted',
    render: (row) => <span title={row.id}>{shortId(row.id)}</span>,
  },
  {
    key: 'state',
    header: 'State',
    className: 'w-24',
    render: (row) => <StatusBadge {...alertStateVisual(row.state)} />,
  },
  {
    key: 'sev',
    header: 'Sev',
    className: 'w-14',
    render: (row) => <StatusBadge {...severityVisual(row.severity)} />,
  },
  {
    key: 'rule',
    header: 'Rule',
    render: (row) => <span className="font-mono text-xs text-bright">{row.ruleName}</span>,
  },
  {
    key: 'service',
    header: 'Service',
    className: 'w-28 font-mono text-2xs',
    render: (row) => shortId(row.serviceId),
  },
  {
    key: 'incident',
    header: 'Incident',
    className: 'w-28 font-mono text-2xs',
    render: (row) => shortId(row.incidentId),
  },
  {
    key: 'fired',
    header: 'Fired',
    className: 'w-28 font-mono text-2xs',
    align: 'right' as const,
    render: (row) => <span title={formatDateTime(row.firedAt)}>{formatRelative(row.firedAt)}</span>,
  },
];

export default function AlertsPage() {
  const [state, setState] = useState('');
  const [severity, setSeverity] = useState('');
  const path = useMemo(() => `/alerts${toQuery({ state, severity })}`, [state, severity]);
  const { data, error, loading, reload } = useResource<Envelope<AlertRecord[]>>(path);
  const rows = data?.data ?? [];

  return (
    <PageShell
      title="Alerts"
      subtitle="Monitor signals across payments, identity, and core banking"
      flush
      toolbar={
        <FilterBar trailing={loading ? 'Loading' : `${rows.length} rows`}>
          <FilterSelect
            label="State"
            value={state}
            onChange={setState}
            options={[
              { value: '', label: 'All' },
              { value: 'FIRING', label: 'Firing' },
              { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
              { value: 'RESOLVED', label: 'Resolved' },
            ]}
          />
          <FilterSelect
            label="Severity"
            value={severity}
            onChange={setSeverity}
            options={[
              { value: '', label: 'All' },
              { value: 'SEV1', label: 'SEV1' },
              { value: 'SEV2', label: 'SEV2' },
              { value: 'SEV3', label: 'SEV3' },
              { value: 'SEV4', label: 'SEV4' },
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
        errorTitle="Unable to load alerts"
        emptyTitle="No alerts in this query"
        emptyDescription="The queue is quiet for the selected state and severity."
        emptyHint="GET /alerts"
        onRetry={reload}
      />
    </PageShell>
  );
}
