# ADR-0005: Two Grafana datasources — Prometheus for live infra, Postgres for the simulated fleet

## Status

Accepted

## Context

Prometheus only ever scrapes the one real process's metrics (see ADR-0003) — HTTP traffic, heap, event-loop lag. The simulated fleet's six-month history (per-service error rate, latency, SLA compliance, incident trends) lives in Postgres and was never designed to flow through a scrape pipeline. The first version of the "BankOps API" dashboard tried to represent both through Prometheus alone and simply couldn't show the fleet's historical data at all.

## Decision

Two Grafana datasources, two dashboards with distinct jobs:

- **Prometheus** (`BankOps API` dashboard): golden signals, saturation, and business gauges for the one real process, refreshed live.
- **BankOps Postgres** (`BankOps Fleet Operations` dashboard): direct SQL against `Metric`/`Incident`/`SlaRecord`/`ServiceDependency` for the simulated fleet's golden signals, SLA/error-budget trends, incident trends, and dependency graph over the full six-month history.

This mirrors a common real-world pattern — Prometheus for live infrastructure, a SQL-backed source for business/historical rollups — rather than forcing one tool to do both jobs badly.

## Consequences

- A metric that should appear on both (e.g. "is this service breaching its SLA") needs two implementations: a live-forward-only Prometheus gauge (`bankops_sla_actual_percent`, only reflects data since Prometheus started scraping) and a full-history SQL query. They will disagree on scope by design, and that's the correct answer, not a bug to reconcile.
- The Postgres datasource is read-only in practice (Grafana never writes back) but has real credentials in `datasources.yml` — see the "no secrets manager" finding in the production-readiness audit for the honest state of that.
- Every SQL panel duplicates its `$service` filter logic (`s.slug ~ '$service'` with `allValue: ".*"`) — the standard Grafana pattern for a regex-based "All" option, and the fix for a real bug where the naive `= '$__all'` comparison silently matched nothing.
