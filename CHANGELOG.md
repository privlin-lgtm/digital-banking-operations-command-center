# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/). Backfilled from real commit history, not written from memory — each entry corresponds to an actual commit, not a rounded-off summary of "roughly what happened that week."

## [Unreleased]

### Added

- Alertmanager, wired end-to-end to a webhook receiver on the API with real delivery verification (ADR-0007).
- Redis-backed rate limiting (shared counters across replicas when `RATE_LIMIT_REDIS_URL` is set).
- Automated Postgres backups (`postgres-backup-local`, daily/weekly/monthly rotation) with a restore procedure verified end to end, not just documented.
- A CD workflow publishing a git-sha-tagged image to GHCR after CI passes.
- Loki + Promtail log aggregation, wired as a Grafana datasource.
- SLO burn-rate alerting (fast/slow, multi-window) for the API's real request success rate.
- `scripts/check-dashboards.mjs` — a smoke check that runs every Grafana panel's query and fails on silently-empty results.
- `bankops_scheduler_last_success_timestamp` plus staleness alerts for all three scheduled jobs.
- Cursor-based pagination and filtering on `GET /api/v1/audit-logs`.
- `Service.complianceScope` / `Service.dataClassification` and `Incident.externalTicketUrl` / `Incident.statusPageUrl`.
- Architecture Decision Records (`docs/architecture/adr/`), an OpenAPI contract served at `/api/v1/docs`, and this changelog.

### Fixed

- A Prometheus label collision (`service`/`job` colliding with the scrape config's own static labels) that silently hid every per-service metric behind one flat `bankops-api` line — found twice, on two different metrics, only by actually reading Grafana's rendered legend.
- The Fleet Operations dashboard's `$service` "All" filter, which never matched the literal string it was compared against and silently returned no data for every filtered panel.
- `AlertRule` gains an opt-in `autoRemediateAction`: a brand-new SEV1 firing now actually invokes the Remediation Engine automatically, closing the gap where "automated remediation" was only reachable via a human calling the API directly.
- The failure-simulator's scheduled tick now takes a Postgres advisory lock (ADR-0008) — the one scheduled job that wasn't already safe under multiple replicas.
- Migrations now run as a one-shot Compose service gated on `service_completed_successfully`, not inline in every API replica's own entrypoint.
- JWT secret and cookie-security fail-closed validation (ADR-0002).

## Milestones (commit history, chronological)

- **Scaffold** — initial monorepo scaffold (Next.js + Express + Prisma), a generic banking-ops placeholder UI.
- **Schema rebuild** — replaced the placeholder domain with the real SRE-ops schema; added Service Management.
- **Incident Management Engine** — severity-driven escalation engine, timeline, comments.
- **Observability hardening** — `/live`, `/ready`, `/health` health-probe split; request-scoped logging.
- **Automated Remediation Engine** — retry/circuit-breaker/fallback around a set of remediation actions.
- **Runbook Management** — versioned runbooks, execution history.
- **SLA Tracking** — error-budget accounting via a pure `SlaCalculator`.
- **Root Cause Analysis** — four-eyes-reviewed RCA reports, corrective actions.
- **Alerting Engine** — threshold-tiered `AlertRule`s, auto-incident creation.
- **Service archival fix** — hard-delete replaced with soft archival (ADR-0001) after it was found to cascade-delete real history.
- **Production Failure Simulator** — chaos-engineering scenarios feeding the real alert-evaluation path.
- **Security & readiness review** — 5 real findings fixed (see `docs/SECURITY_AND_READINESS_REVIEW.md`).
- **Web UI rebuilt as an operations console** — API-backed incidents, alerts, services, runbooks, and SLA views, replacing the original placeholder pages.
- **Six-month history generator** — deterministic seed data across 12 simulated services, 57 incidents, six named failure archetypes.
- **Grafana rebuild** — golden signals, SLA/error-budget tracking, service dependency graph, a second Postgres-backed dashboard for the simulated fleet's full history.
- **Production-readiness audit fixes** — every P0/P1/P2 finding from a from-scratch audit, each verified against the live stack.
