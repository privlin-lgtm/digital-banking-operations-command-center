'use client';

import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { BarGauge } from '@/components/ui/Charts';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSelect } from '@/components/ui/FilterBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useResource } from '@/hooks/useResource';
import { toQuery } from '@/lib/api';
import { formatDateTime, formatPercent, parsePercent, shortId } from '@/lib/format';
import type { Envelope, SlaRecord } from '@/lib/types';

const COLUMNS: Column<SlaRecord>[] = [
  {
    key: 'breach',
    header: 'Posture',
    className: 'w-24',
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
    className: 'w-24 font-mono text-2xs',
    render: (row) => shortId(row.serviceId),
  },
  {
    key: 'window',
    header: 'Window',
    className: 'w-20 font-mono text-2xs',
    render: (row) => row.windowType,
  },
  {
    key: 'target',
    header: 'Target',
    className: 'w-20 font-mono text-2xs tabular-nums',
    align: 'right',
    render: (row) => formatPercent(row.targetPercent),
  },
  {
    key: 'actual',
    header: 'Actual',
    className: 'w-20 font-mono text-2xs tabular-nums text-bright',
    align: 'right',
    render: (row) => formatPercent(row.actualPercent),
  },
  {
    key: 'gauge',
    header: 'Vs target',
    className: 'w-36',
    render: (row) => {
      const actual = parsePercent(row.actualPercent);
      const target = parsePercent(row.targetPercent);
      if (actual === null || target === null) {
        return <span className="text-muted">—</span>;
      }
      return <BarGauge actual={actual} target={target} breached={row.breached} />;
    },
  },
  {
    key: 'start',
    header: 'Start',
    className: 'w-36 font-mono text-2xs',
    render: (row) => formatDateTime(row.windowStart),
  },
  {
    key: 'end',
    header: 'End',
    className: 'w-36 font-mono text-2xs',
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
      subtitle="Availability windows versus target for the selected period"
      flush
      toolbar={
        <FilterBar trailing={loading ? 'Loading' : `${rows.length} breaches`}>
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
        getRowAccent={(row) => (row.breached ? 'critical' : 'healthy')}
        frameless
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
