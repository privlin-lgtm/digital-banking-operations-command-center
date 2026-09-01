'use client';

import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSelect } from '@/components/ui/FilterBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useResource } from '@/hooks/useResource';
import { toQuery } from '@/lib/api';
import { formatDateTime, shortId } from '@/lib/format';
import { serviceStatusVisual, tierVisual } from '@/lib/status';
import type { Envelope, ServiceRecord } from '@/lib/types';

const COLUMNS: Column<ServiceRecord>[] = [
  {
    key: 'status',
    header: 'Status',
    className: 'w-24',
    render: (row) => <StatusBadge {...serviceStatusVisual(row.status)} />,
  },
  {
    key: 'tier',
    header: 'Tier',
    className: 'w-12',
    render: (row) => <StatusBadge {...tierVisual(row.tier)} />,
  },
  {
    key: 'name',
    header: 'Service',
    render: (row) => (
      <div>
        <p className="text-bright">{row.name}</p>
        <p className="font-mono text-2xs text-muted">{row.slug}</p>
      </div>
    ),
  },
  {
    key: 'owner',
    header: 'Owner',
    className: 'w-40',
    render: (row) => row.ownerTeam,
  },
  {
    key: 'id',
    header: 'ID',
    className: 'w-24 font-mono text-2xs text-muted',
    render: (row) => <span title={row.id}>{shortId(row.id)}</span>,
  },
  {
    key: 'created',
    header: 'Registered',
    className: 'w-36 font-mono text-2xs',
    align: 'right',
    render: (row) => formatDateTime(row.createdAt),
  },
];

export default function ServicesPage() {
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const path = useMemo(() => `/services${toQuery({ status, tier })}`, [status, tier]);
  const { data, error, loading, reload } = useResource<Envelope<ServiceRecord[]>>(path);
  const rows = data?.data ?? [];

  return (
    <PageShell
      title="Services"
      subtitle="Production catalog, health, and ownership"
      flush
      toolbar={
        <FilterBar trailing={loading ? 'Loading' : `${rows.length} rows`}>
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: 'All' },
              { value: 'HEALTHY', label: 'Healthy' },
              { value: 'DEGRADED', label: 'Degraded' },
              { value: 'CRITICAL', label: 'Critical' },
              { value: 'MAINTENANCE', label: 'Maintenance' },
              { value: 'UNKNOWN', label: 'Unknown' },
            ]}
          />
          <FilterSelect
            label="Tier"
            value={tier}
            onChange={setTier}
            options={[
              { value: '', label: 'All' },
              { value: 'TIER_1', label: 'T1' },
              { value: 'TIER_2', label: 'T2' },
              { value: 'TIER_3', label: 'T3' },
              { value: 'TIER_4', label: 'T4' },
            ]}
          />
        </FilterBar>
      }
    >
      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowKey={(row) => row.id}
        getRowAccent={(row) => serviceStatusVisual(row.status).tone}
        frameless
        loading={loading}
        error={error}
        errorTitle="Unable to load services"
        emptyTitle="No services in catalog"
        emptyDescription="Nothing matches the selected status and tier."
        emptyHint="GET /services"
        onRetry={reload}
      />
    </PageShell>
  );
}
