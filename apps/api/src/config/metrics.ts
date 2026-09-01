import type { RequestHandler } from 'express';
import client from 'prom-client';
import { prisma } from './prisma.js';

const register = new client.Registry();
// Prefixed with the app's own labels, this already covers "Memory usage"
// and "CPU usage" from the observability requirements — process_cpu_seconds_total,
// process_resident_memory_bytes, nodejs_heap_size_used_bytes, event loop
// lag, GC pauses, and more, all for free from prom-client's own collectors.
client.collectDefaultMetrics({ register, prefix: 'bankops_' });

const httpDuration = new client.Histogram({
  name: 'bankops_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequests = new client.Counter({
  name: 'bankops_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

// Request rate, error rate, and throughput are all derivable from the
// counter above via PromQL (rate(), filtered by status_code) rather than
// tracked as separate metrics — a second counter recording the same
// events under a different name would just be redundant cardinality.
// Latency percentiles (p50/p95/p99) come from the histogram via
// histogram_quantile() at query time; prom-client computes buckets, not
// percentiles, which is the correct division of labor between the client
// library and Prometheus/Grafana.

const OPEN_INCIDENT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'MITIGATED'] as const;

/**
 * Business metrics computed at scrape time, not maintained incrementally.
 * prom-client's `collect()` hook runs only when something actually reads
 * `/metrics` (every 10-15s per prometheus.yml), so this is a handful of
 * cheap aggregate queries per scrape interval, not per request — the
 * right trade for a number that changes slowly compared to HTTP traffic.
 */
new client.Gauge({
  name: 'bankops_incidents_open_total',
  help: 'Currently open incidents by severity (not resolved or closed)',
  labelNames: ['severity'] as const,
  registers: [register],
  async collect() {
    const rows = await prisma.incident.groupBy({
      by: ['severity'],
      where: { status: { in: [...OPEN_INCIDENT_STATUSES] } },
      _count: { _all: true },
    });
    for (const row of rows) {
      this.set({ severity: row.severity }, row._count._all);
    }
  },
});

new client.Gauge({
  name: 'bankops_alerts_firing_total',
  help: 'Currently firing alerts by severity (FIRING or ACKNOWLEDGED, not yet RESOLVED)',
  labelNames: ['severity'] as const,
  registers: [register],
  async collect() {
    const rows = await prisma.alert.groupBy({
      by: ['severity'],
      where: { state: { in: ['FIRING', 'ACKNOWLEDGED'] } },
      _count: { _all: true },
    });
    for (const row of rows) {
      this.set({ severity: row.severity }, row._count._all);
    }
  },
});

new client.Gauge({
  name: 'bankops_failure_simulations_active',
  help: 'Currently running chaos-engineering fault injections, by scenario',
  labelNames: ['scenario'] as const,
  registers: [register],
  async collect() {
    const rows = await prisma.failureSimulation.groupBy({
      by: ['scenario'],
      where: { stoppedAt: null },
      _count: { _all: true },
    });
    for (const row of rows) {
      this.set({ scenario: row.scenario }, row._count._all);
    }
  },
});

new client.Gauge({
  name: 'bankops_sla_breaches_current',
  help: 'Services currently breaching their SLA in the most recent monthly window',
  // Named bank_service, not service: the bankops-api scrape job in
  // prometheus.yml already attaches a static `service: bankops-api` label
  // to every metric it collects. Prometheus's default (honor_labels: false)
  // resolves that collision by renaming *this* label to exported_service
  // and keeping the scrape config's value — every series silently reports
  // service="bankops-api" instead of the real one. Found by actually
  // checking Grafana's rendered legend, not by reading the code.
  labelNames: ['bank_service'] as const,
  registers: [register],
  async collect() {
    // Latest row per service, not an exact match on "the 1st of this month
    // at local midnight" — the app and whatever computed a given SlaRecord
    // (a one-off backfill script, a different container, a different TZ)
    // don't share a clock, so an exact-timestamp match on windowStart is a
    // real way to silently return nothing.
    const rows = await prisma.slaRecord.findMany({
      where: { windowType: 'MONTHLY', breached: true },
      orderBy: { windowStart: 'desc' },
      distinct: ['serviceId'],
      select: { service: { select: { slug: true } } },
    });
    for (const row of rows) {
      this.set({ bank_service: row.service.slug }, 1);
    }
  },
});

/**
 * The actual percentage, not just a binary breach flag — a Grafana panel
 * charting this against a target-line threshold shows how close a service
 * is to breaching, not just whether it already has. Only reflects the
 * current month going forward from whenever Prometheus started scraping;
 * it does not backfill history that predates this deployment (that history
 * lives in Postgres — see the "BankOps Fleet Operations" dashboard, which
 * queries SlaRecord directly for the full six-month trend).
 */
new client.Gauge({
  name: 'bankops_sla_actual_percent',
  help: "Current month's actual SLA percentage per service (compare against each service's target in the fleet dashboard)",
  // See bankops_sla_breaches_current above for why this is bank_service, not service.
  labelNames: ['bank_service'] as const,
  registers: [register],
  async collect() {
    const rows = await prisma.slaRecord.findMany({
      where: { windowType: 'MONTHLY' },
      orderBy: { windowStart: 'desc' },
      distinct: ['serviceId'],
      select: { actualPercent: true, service: { select: { slug: true } } },
    });
    for (const row of rows) {
      this.set({ bank_service: row.service.slug }, Number(row.actualPercent));
    }
  },
});

/**
 * Remediation activity in the last 24h, by outcome. A rolling window
 * recomputed at scrape time (like every other business gauge here) rather
 * than an incrementing Counter — there's no in-process write path to hook
 * a counter into without threading prom-client through the repository
 * layer, and a 24h rollup is exactly what a "how much remediation is
 * happening" panel wants to chart over time regardless.
 */
new client.Gauge({
  name: 'bankops_runbook_executions_24h',
  help: 'Runbook executions recorded in the last 24 hours, by outcome',
  labelNames: ['outcome'] as const,
  registers: [register],
  async collect() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await prisma.incidentRunbook.groupBy({
      by: ['outcome'],
      where: { executedAt: { gte: since } },
      _count: { _all: true },
    });
    for (const row of rows) {
      this.set({ outcome: row.outcome }, row._count._all);
    }
  },
});

/**
 * A static "info" metric (always 1) encoding the service dependency graph
 * as labels — the standard Prometheus pattern (cf. kube_pod_info) for
 * exposing relational, rarely-changing data through a metrics endpoint so
 * a dashboard can render it as a table without a second datasource.
 */
new client.Gauge({
  name: 'bankops_service_dependency_info',
  help: 'Service dependency graph edges (always 1; join on the labels)',
  // See bankops_sla_breaches_current above for why this is bank_service, not service.
  labelNames: ['bank_service', 'depends_on', 'type'] as const,
  registers: [register],
  async collect() {
    const rows = await prisma.serviceDependency.findMany({
      select: {
        dependencyType: true,
        service: { select: { slug: true } },
        dependsOnService: { select: { slug: true } },
      },
    });
    for (const row of rows) {
      this.set(
        {
          bank_service: row.service.slug,
          depends_on: row.dependsOnService.slug,
          type: row.dependencyType,
        },
        1,
      );
    }
  },
});

export function metricsMiddleware(): RequestHandler {
  return (req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      end(labels);
      httpRequests.inc(labels);
    });
    next();
  };
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export function metricsContentType(): string {
  return register.contentType;
}
