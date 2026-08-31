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
  labelNames: ['service'] as const,
  registers: [register],
  async collect() {
    const windowStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const rows = await prisma.slaRecord.findMany({
      where: { windowType: 'MONTHLY', windowStart, breached: true },
      select: { service: { select: { slug: true } } },
    });
    for (const row of rows) {
      this.set({ service: row.service.slug }, 1);
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
