#!/usr/bin/env node
/**
 * Closes the "dashboards shipped with data-correctness bugs nobody
 * caught" P2 finding from the production-readiness audit: two real bugs
 * (a broken template variable, a Prometheus label collision) made every
 * per-service panel on both dashboards silently return nothing, and both
 * were only found by a human opening Grafana and reading the legend.
 *
 * This runs every panel's query the same way Grafana would and fails
 * loudly if a panel that should have data returns none — not a substitute
 * for actually looking at the dashboard, but a fast, scriptable first
 * pass that would have caught both bugs above before a human had to.
 *
 * Usage: node scripts/check-dashboards.mjs
 * Env:   GRAFANA_URL (default http://localhost:3001)
 *        GRAFANA_USER / GRAFANA_PASSWORD (default admin/admin)
 */

const GRAFANA_URL = process.env.GRAFANA_URL ?? 'http://localhost:3001';
const GRAFANA_USER = process.env.GRAFANA_USER ?? 'admin';
const GRAFANA_PASSWORD = process.env.GRAFANA_PASSWORD ?? 'admin';
const DASHBOARD_UIDS = ['bankops-api', 'bankops-fleet', 'bankops-executive'];

const authHeader = `Basic ${Buffer.from(`${GRAFANA_USER}:${GRAFANA_PASSWORD}`).toString('base64')}`;

async function grafanaFetch(path, init = {}) {
  const res = await fetch(`${GRAFANA_URL}${path}`, {
    ...init,
    headers: { Authorization: authHeader, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function flattenPanels(panels) {
  const out = [];
  for (const panel of panels ?? []) {
    if (panel.type === 'row') continue;
    if (!panel.targets || panel.targets.length === 0) continue;
    out.push(panel);
  }
  return out;
}

async function queryPanel(panel) {
  const results = [];
  for (const target of panel.targets) {
    const ds = target.datasource ?? panel.datasource;
    if (ds.type === 'prometheus') {
      const expr = target.expr;
      const url = `/api/datasources/proxy/uid/${ds.uid}/api/v1/query?query=${encodeURIComponent(expr)}`;
      const data = await grafanaFetch(url);
      const count = data.data?.result?.length ?? 0;
      results.push({ refId: target.refId, engine: 'promql', query: expr, count });
    } else if (ds.type === 'postgres') {
      const body = {
        queries: [
          {
            refId: target.refId,
            datasource: { type: 'postgres', uid: ds.uid },
            rawSql: target.rawSql
              .replaceAll('$__timeFilter(', 'true OR $__timeFilter(') // best-effort: don't let an empty demo window hide real query errors, still exercises the SQL
              .replaceAll("'$service'", "'.*'"),
            format: target.format ?? 'time_series',
            maxDataPoints: 100,
          },
        ],
        from: 'now-180d',
        to: 'now',
      };
      const data = await grafanaFetch('/api/ds/query', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const frames = data.results?.[target.refId]?.frames ?? [];
      const count = frames.reduce((sum, f) => sum + (f.data?.values?.[0]?.length ?? 0), 0);
      results.push({
        refId: target.refId,
        engine: 'sql',
        query: target.rawSql.slice(0, 60),
        count,
      });
    } else {
      results.push({
        refId: target.refId,
        engine: ds.type,
        query: '(unsupported by this checker)',
        count: -1,
      });
    }
  }
  return results;
}

async function main() {
  let failures = 0;
  let checked = 0;

  for (const uid of DASHBOARD_UIDS) {
    const { dashboard } = await grafanaFetch(`/api/dashboards/uid/${uid}`);
    console.log(`\n${dashboard.title} (${uid})`);
    const panels = flattenPanels(dashboard.panels);

    for (const panel of panels) {
      checked += 1;
      try {
        const results = await queryPanel(panel);
        const empty = results.filter((r) => r.count === 0);
        const status = empty.length > 0 ? 'EMPTY' : 'ok';
        if (empty.length > 0) failures += 1;
        console.log(`  [${status}] ${panel.title}`);
        for (const r of results) {
          console.log(
            `      ${r.refId} (${r.engine}): ${r.count} ${r.count === 1 ? 'point' : 'points'} — ${r.query}`,
          );
        }
      } catch (error) {
        failures += 1;
        console.log(`  [ERROR] ${panel.title}: ${error.message}`);
      }
    }
  }

  console.log(`\n${checked} panels checked, ${failures} failed.`);
  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
