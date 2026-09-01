'use client';

import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSearch, FilterSelect } from '@/components/ui/FilterBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useResource } from '@/hooks/useResource';
import { toQuery } from '@/lib/api';
import { shortId } from '@/lib/format';
import type { Envelope, RunbookRecord } from '@/lib/types';

const COLUMNS: Column<RunbookRecord>[] = [
  {
    key: 'active',
    header: 'State',
    className: 'w-24',
    render: (row) => (
      <StatusBadge
        tone={row.isActive ? 'healthy' : 'neutral'}
        label={row.isActive ? 'ACTIVE' : 'INACTIVE'}
      />
    ),
  },
  {
    key: 'category',
    header: 'Category',
    className: 'w-36',
    render: (row) => <span className="font-mono text-2xs text-muted">{row.category}</span>,
  },
  {
    key: 'title',
    header: 'Runbook',
    render: (row) => (
      <div>
        <p className="text-bright">{row.title}</p>
        <p className="font-mono text-2xs text-muted">{row.slug}</p>
      </div>
    ),
  },
  {
    key: 'trigger',
    header: 'Trigger',
    render: (row) => <span className="line-clamp-2 text-muted">{row.triggerCondition}</span>,
  },
  {
    key: 'version',
    header: 'Ver',
    className: 'w-16 font-mono text-2xs',
    render: (row) => `v${row.version}`,
  },
  {
    key: 'id',
    header: 'ID',
    className: 'w-24 font-mono text-2xs text-muted',
    render: (row) => <span title={row.id}>{shortId(row.id)}</span>,
  },
];

export default function RunbooksPage() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState('');
  const path = useMemo(
    () =>
      `/runbooks${toQuery({ q: q.trim() || undefined, category, isActive: isActive === '' ? undefined : isActive === 'true' })}`,
    [q, category, isActive],
  );
  const { data, error, loading, reload } = useResource<Envelope<RunbookRecord[]>>(path);
  const rows = data?.data ?? [];

  return (
    <PageShell
      title="Runbooks"
      subtitle="Approved response procedures linked from incident command."
      toolbar={
        <FilterBar
          trailing={
            <span className="font-mono text-2xs text-muted">
              {loading ? 'Loading…' : `${rows.length} rows`}
            </span>
          }
        >
          <FilterSearch label="Search" value={q} placeholder="Title or trigger" onChange={setQ} />
          <FilterSelect
            label="Category"
            value={category}
            onChange={setCategory}
            options={[
              { value: '', label: 'All' },
              { value: 'DATABASE', label: 'Database' },
              { value: 'INFRASTRUCTURE', label: 'Infrastructure' },
              { value: 'APPLICATION', label: 'Application' },
              { value: 'SECURITY', label: 'Security' },
              { value: 'MONITORING', label: 'Monitoring' },
            ]}
          />
          <FilterSelect
            label="Active"
            value={isActive}
            onChange={setIsActive}
            options={[
              { value: '', label: 'All' },
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
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
        errorTitle="Unable to load runbooks"
        emptyTitle="No runbooks published"
        emptyDescription="No procedure matches the current search and category filters."
        emptyHint="GET /runbooks"
        onRetry={reload}
      />
    </PageShell>
  );
}
