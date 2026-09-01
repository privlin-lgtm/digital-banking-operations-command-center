'use client';

import { PageShell } from '@/components/layout/PageShell';
import { BarList, StackedBar } from '@/components/ui/Charts';
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
const SERVICE_ORDER = ['CRITICAL', 'DEGRADED', 'MAINTENANCE', 'UNKNOWN', 'HEALTHY'] as const;
const SEV_ORDER = [{ key: 'P1' }, { key: 'P2' }, { key: 'P3' }, { key: 'P4' }] as const;

function normalizeSeverity(value: string): string {
  return value.startsWith('SEV') ? `P${value.slice(3)}` : value;
}

const INCIDENT_COLUMNS: Column<IncidentRecord>[] = [
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
    header: 'Incident',
    render: (row) => <span className="text-bright">{row.title}</span>,
  },
  {
    key: 'service',
    header: 'Service',
    className: 'w-24 font-mono text-2xs',
    render: (row) => shortId(row.primaryServiceId),
  },
  {
    key: 'opened',
    header: 'Opened',
    className: 'w-28 font-mono text-2xs',
    align: 'right',
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

  const serviceSegments = SERVICE_ORDER.map((status) => ({
    label: status,
    value: serviceRows.filter((row) => row.status === status).length,
    tone: serviceStatusVisual(status).tone,
  }));

  const severitySegments = SEV_ORDER.map((sev) => ({
    label: sev.key,
    value: activeIncidents.filter((row) => normalizeSeverity(row.severity) === sev.key).length,
    tone: severityVisual(sev.key).tone,
  }));

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
      subtitle="Production posture for the current desk shift"
      actions={
        <button type="button" className="ops-btn-ghost" onClick={reloadAll}>
          Refresh
        </button>
      }
    >
      <div className="flex flex-col gap-px border border-line bg-line">
        <div className="grid gap-px md:grid-cols-2 xl:grid-cols-4">
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
                hint="Open / ack / mitigated"
                tone={activeIncidents.length > 0 ? 'critical' : 'healthy'}
              />
              <MetricCard
                label="Firing alerts"
                value={firingAlerts.length}
                hint="Unresolved monitors"
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
                hint="Monthly window"
                tone={slaRows.length > 0 ? 'degraded' : 'healthy'}
              />
            </>
          )}
        </div>

        <div className="grid gap-px xl:grid-cols-3">
          <Panel title="Platform health" padded>
            {health.loading && !health.data ? (
              <p className="font-mono text-2xs text-muted">Probing /health</p>
            ) : health.error ? (
              <ErrorState
                title="Health endpoint failed"
                error={health.error}
                onRetry={health.reload}
              />
            ) : health.data ? (
              <HealthGrid health={health.data} />
            ) : (
              <p className="text-2xs text-muted">No health payload.</p>
            )}
          </Panel>
          <Panel title="Service status" padded>
            {services.loading && serviceRows.length === 0 ? (
              <p className="font-mono text-2xs text-muted">Loading catalog</p>
            ) : services.error ? (
              <ErrorState
                title="Unable to load services"
                error={services.error}
                onRetry={services.reload}
              />
            ) : (
              <div className="space-y-3">
                <StackedBar segments={serviceSegments} ariaLabel="Service status distribution" />
                <BarList items={serviceSegments} />
              </div>
            )}
          </Panel>
          <Panel title="Active incident severity" padded>
            {incidents.loading && incidentRows.length === 0 ? (
              <p className="font-mono text-2xs text-muted">Loading incidents</p>
            ) : incidents.error ? (
              <ErrorState
                title="Unable to load incidents"
                error={incidents.error}
                onRetry={incidents.reload}
              />
            ) : (
              <div className="space-y-3">
                <StackedBar segments={severitySegments} ariaLabel="Active incident severity mix" />
                <BarList items={severitySegments} />
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Active incidents">
          <DataTable
            columns={INCIDENT_COLUMNS}
            rows={activeIncidents}
            getRowKey={(row) => row.id}
            getRowAccent={(row) => severityVisual(row.severity).tone}
            loading={incidents.loading}
            error={incidents.error}
            errorTitle="Unable to load incidents"
            emptyTitle="No active incidents"
            emptyDescription="Nothing is open, acknowledged, or mitigated."
            emptyHint="GET /incidents"
            onRetry={incidents.reload}
            frameless
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
    <table className="w-full text-left">
      <tbody>
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
          detail={incidentCount === null ? 'unknown' : String(incidentCount)}
        />
        <HealthRow
          label="SLA breaches"
          visual={
            typeof slaBreaches === 'number' && slaBreaches > 0
              ? healthVisual('degraded')
              : healthVisual('healthy')
          }
          detail={slaBreaches === null || slaBreaches === undefined ? 'n/a' : String(slaBreaches)}
        />
        <tr className="border-t border-line">
          <th className="py-1.5 pr-3 text-2xs font-normal text-muted">Last scrape</th>
          <td className="py-1.5 font-mono text-2xs text-ink">{formatDateTime(health.timestamp)}</td>
        </tr>
      </tbody>
    </table>
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
    <tr>
      <th className="py-1 pr-3 text-2xs font-normal text-muted">{label}</th>
      <td className="py-1">
        <div className="flex items-center gap-2">
          <StatusBadge {...visual} />
          <span className="font-mono text-2xs text-muted">{detail}</span>
        </div>
      </td>
    </tr>
  );
}
