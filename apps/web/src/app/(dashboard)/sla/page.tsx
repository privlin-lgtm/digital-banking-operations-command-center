'use client';

import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSelect } from '@/components/ui/FilterBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useResource } from '@/hooks/useResource';
import { toQuery } from '@/lib/api';
import { formatDateTime, formatPercent, shortId } from '@/lib/format';
import type { Envelope, SlaRecord } from '@/lib/types';

const COLUMNS: Column<SlaRecord>[] = [
  {
    key: 'breach',
    header: 'Posture',
    className: 'w-28',
    render: (row) => (
      <StatusBadge
        tone={row.breached ? 'critical' : 'healthy'}
        label={row.breached ? 'BREACHED' : 'MET'}
      />
    ),
  },
  {
    key: 'service',
    header: 'Service',
    className: 'w-28 font-mono text-2xs',
    render: (row) => shortId(row.serviceId),
  },
  {
    key: 'window',
    header: 'Window',
    className: 'w-24 font-mono text-2xs',
    render: (row) => row.windowType,
  },
  {
    key: 'target',
    header: 'Target',
    className: 'w-24 font-mono text-xs tabular-nums',
    render: (row) => formatPercent(row.targetPercent),
  },
  {
    key: 'actual',
    header: 'Actual',
    className: 'w-24 font-mono text-xs tabular-nums text-bright',
    render: (row) => formatPercent(row.actualPercent),
  },
  {
    key: 'start',
    header: 'Start',
    className: 'w-40 font-mono text-2xs',
    render: (row) => formatDateTime(row.windowStart),
  },
  {
    key: 'end',
    header: 'End',
    className: 'w-40 font-mono text-2xs',
    render: (row) => formatDateTime(row.windowEnd),
  },
];

export default function SlaPage() {
  const [windowType, setWindowType] = useState('MONTHLY');
  const path = useMemo(() => `/sla/breaches${toQuery({ windowType })}`, [windowType]);
  const { data, error, loading, reload } = useResource<Envelope<SlaRecord[]>>(path);
  const rows = data?.data ?? [];

  return (
    <PageShell
      title="SLA"
      subtitle="Availability windows that missed target for the selected period."
      toolbar={
        <FilterBar
          trailing={
            <span className="font-mono text-2xs text-muted">
              {loading ? 'Loading…' : `${rows.length} breaches`}
            </span>
          }
        >
          <FilterSelect
            label="Window"
            value={windowType}
            onChange={setWindowType}
            options={[
              { value: 'DAILY', label: 'Daily' },
              { value: 'WEEKLY', label: 'Weekly' },
              { value: 'MONTHLY', label: 'Monthly' },
            ]}
          />
        </FilterBar>
      }
    >
      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowKey={(row) => row.id}
        loading={loading}
        error={error}
        errorTitle="Unable to load SLA breaches"
        emptyTitle="No SLA breaches in this window"
        emptyDescription="All tracked services are inside target for the selected period."
        emptyHint="GET /sla/breaches"
        onRetry={reload}
      />
    </PageShell>
  );
}
