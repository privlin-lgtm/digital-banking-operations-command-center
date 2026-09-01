'use client';

import { PageShell } from '@/components/layout/PageShell';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { MetricCard } from '@/components/ui/MetricCard';
import { MetricSkeleton } from '@/components/ui/Skeleton';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useResource } from '@/hooks/useResource';
import { formatDateTime, formatRelative, shortId } from '@/lib/format';
import {
  healthVisual,
  incidentStatusVisual,
  serviceStatusVisual,
  severityVisual,
} from '@/lib/status';
import type {
  Envelope,
  HealthResponse,
  IncidentRecord,
  AlertRecord,
  ServiceRecord,
  SlaRecord,
} from '@/lib/types';
import { isCountMap } from '@/lib/types';

const ACTIVE = new Set(['OPEN', 'ACKNOWLEDGED', 'MITIGATED']);

const INCIDENT_COLUMNS: Column<IncidentRecord>[] = [
  {
    key: 'sev',
    header: 'Sev',
    className: 'w-20',
    render: (row) => <StatusBadge {...severityVisual(row.severity)} />,
  },
  {
    key: 'status',
    header: 'Status',
    className: 'w-28',
    render: (row) => <StatusBadge {...incidentStatusVisual(row.status)} />,
  },
  {
    key: 'title',
    header: 'Incident',
    render: (row) => <span className="text-bright">{row.title}</span>,
  },
  {
    key: 'service',
    header: 'Service',
    className: 'w-32 font-mono text-2xs',
    render: (row) => shortId(row.primaryServiceId),
  },
  {
    key: 'opened',
    header: 'Opened',
    className: 'w-36 font-mono text-2xs',
    render: (row) => (
      <span title={formatDateTime(row.openedAt)}>{formatRelative(row.openedAt)}</span>
    ),
  },
];

export default function OverviewPage() {
  const health = useResource<HealthResponse>('/health');
  const incidents = useResource<Envelope<IncidentRecord[]>>('/incidents');
  const alerts = useResource<Envelope<AlertRecord[]>>('/alerts?state=FIRING');
  const services = useResource<Envelope<ServiceRecord[]>>('/services');
  const sla = useResource<Envelope<SlaRecord[]>>('/sla/breaches?windowType=MONTHLY');

  const incidentRows = incidents.data?.data ?? [];
  const activeIncidents = incidentRows.filter((row) => ACTIVE.has(row.status));
  const firingAlerts = alerts.data?.data ?? [];
  const serviceRows = services.data?.data ?? [];
  const slaRows = sla.data?.data ?? [];
  const criticalServices = serviceRows.filter((row) => row.status === 'CRITICAL');

  const metricsLoading = incidents.loading || alerts.loading || services.loading || sla.loading;

  function reloadAll() {
    health.reload();
    incidents.reload();
    alerts.reload();
    services.reload();
    sla.reload();
  }

  return (
    <PageShell
      title="Overview"
      subtitle="Shift snapshot across service health, incidents, and SLA posture."
      actions={
        <button type="button" className="ops-btn-ghost" onClick={reloadAll}>
          Refresh
        </button>
      }
    >
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {metricsLoading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              label="Active incidents"
              value={activeIncidents.length}
              hint="Open / acknowledged / mitigated"
              tone={activeIncidents.length > 0 ? 'critical' : 'healthy'}
            />
            <MetricCard
              label="Firing alerts"
              value={firingAlerts.length}
              hint="Unresolved monitor signals"
              tone={firingAlerts.length > 0 ? 'high' : 'healthy'}
            />
            <MetricCard
              label="Critical services"
              value={criticalServices.length}
              hint={`${serviceRows.length} in catalog`}
              tone={criticalServices.length > 0 ? 'critical' : 'healthy'}
            />
            <MetricCard
              label="SLA breaches"
              value={slaRows.length}
              hint="Current monthly window"
              tone={slaRows.length > 0 ? 'degraded' : 'healthy'}
            />
          </>
        )}
      </div>

      <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel title="Platform health" padded>
          {health.loading && !health.data ? (
            <p className="font-mono text-2xs text-muted">Probing /health…</p>
          ) : health.error ? (
            <ErrorState
              title="Health endpoint failed"
              error={health.error}
              onRetry={health.reload}
            />
          ) : health.data ? (
            <HealthGrid health={health.data} />
          ) : (
            <p className="text-xs text-muted">No health payload.</p>
          )}
        </Panel>
        <Panel title="Service status" padded>
          {services.loading && serviceRows.length === 0 ? (
            <p className="font-mono text-2xs text-muted">Loading catalog…</p>
          ) : services.error ? (
            <ErrorState
              title="Unable to load services"
              error={services.error}
              onRetry={services.reload}
            />
          ) : (
            <ServiceStatusGrid services={serviceRows} />
          )}
        </Panel>
      </div>

      <div className="mt-3">
        <Panel title="Active incidents">
          <DataTable
            columns={INCIDENT_COLUMNS}
            rows={activeIncidents}
            getRowKey={(row) => row.id}
            loading={incidents.loading}
            error={incidents.error}
            errorTitle="Unable to load incidents"
            emptyTitle="No active incidents"
            emptyDescription="Nothing is open, acknowledged, or mitigated on this desk."
            emptyHint="GET /incidents"
            onRetry={incidents.reload}
          />
        </Panel>
      </div>
    </PageShell>
  );
}

function HealthGrid({ health }: { health: HealthResponse }) {
  const db = health.checks.database?.status;
  const slaBreaches = health.checks.slaBreaches;
  const incidents = health.checks.openIncidents;
  const incidentCount = isCountMap(incidents)
    ? Object.values(incidents).reduce((sum, count) => sum + count, 0)
    : null;

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <HealthRow label="API" visual={healthVisual(health.status)} detail={health.service} />
      <HealthRow
        label="Database"
        visual={healthVisual(db)}
        detail={db ? db.toUpperCase() : 'UNKNOWN'}
      />
      <HealthRow
        label="Open incidents"
        visual={
          incidentCount === null
            ? healthVisual('unknown')
            : incidentCount > 0
              ? healthVisual('degraded')
              : healthVisual('healthy')
        }
        detail={incidentCount === null ? 'unknown' : `${incidentCount} active`}
      />
      <HealthRow
        label="SLA (health)"
        visual={
          typeof slaBreaches === 'number' && slaBreaches > 0
            ? healthVisual('degraded')
            : healthVisual('healthy')
        }
        detail={
          slaBreaches === null || slaBreaches === undefined ? 'n/a' : `${slaBreaches} monthly`
        }
      />
      <div className="sm:col-span-2">
        <dt className="text-2xs uppercase tracking-[0.12em] text-muted">Last scrape</dt>
        <dd className="mt-1 font-mono text-2xs text-ink">{formatDateTime(health.timestamp)}</dd>
      </div>
    </dl>
  );
}

function HealthRow({
  label,
  visual,
  detail,
}: {
  label: string;
  visual: ReturnType<typeof healthVisual>;
  detail: string;
}) {
  return (
    <div>
      <dt className="text-2xs uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1.5 flex items-center gap-2">
        <StatusBadge {...visual} />
        <span className="font-mono text-2xs text-muted">{detail}</span>
      </dd>
    </div>
  );
}

function ServiceStatusGrid({ services }: { services: ServiceRecord[] }) {
  const order = ['CRITICAL', 'DEGRADED', 'MAINTENANCE', 'UNKNOWN', 'HEALTHY'] as const;
  const counts = Object.fromEntries(order.map((status) => [status, 0])) as Record<
    (typeof order)[number],
    number
  >;
  for (const service of services) {
    counts[service.status] += 1;
  }

  return (
    <ul className="space-y-2">
      {order.map((status) => (
        <li key={status} className="flex items-center justify-between gap-3">
          <StatusBadge {...serviceStatusVisual(status)} />
          <span className="font-mono text-sm tabular-nums text-bright">{counts[status]}</span>
        </li>
      ))}
    </ul>
  );
}
