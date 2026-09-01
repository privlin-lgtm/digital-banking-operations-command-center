# BankOps Control Center

An incident-management and reliability-engineering platform: severity-tiered alerting, incident command, root-cause analysis, runbooks, SLA/error-budget tracking, and chaos engineering — operated against a simulated 12-service bank fleet with six months of realistic operational history.

**Read this first**: [`docs/architecture/adr/0003-simulated-fleet-not-real-microservices.md`](docs/architecture/adr/0003-simulated-fleet-not-real-microservices.md). There is exactly one real deployable in this system — the API below, backed by one Postgres instance. The 12-service fleet is generated seed data standing in for a fleet this platform is built to _monitor_, not services this platform _is_.

## What's actually here

| Layer          | What it is                                                                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API**        | Express 5 + TypeScript + Prisma, one real deployable. Narrow-ports DI, no framework — see [ADR-0004](docs/architecture/adr/0004-narrow-ports-over-a-di-framework.md).                                                                             |
| **Web**        | Next.js 15 operations console — real incident queue, alerts, services, runbooks, and SLA views against the live API.                                                                                                                              |
| **Database**   | PostgreSQL. `apps/api/prisma/seed-history/` generates a deterministic six-month operational history: 12 services, a real dependency graph, ~57 incidents across 6 named failure archetypes, RCA reports, SLA rollups.                             |
| **Monitoring** | Prometheus (the API's own live metrics) + a second Grafana dashboard reading Postgres directly for the simulated fleet's history — see [ADR-0005](docs/architecture/adr/0005-two-datasource-grafana-architecture.md).                             |
| **Alerting**   | 9 Prometheus rules (golden signals, saturation, SLO burn-rate, scheduler health, business signals) delivered through Alertmanager to a webhook receiver on the API — see [ADR-0007](docs/architecture/adr/0007-alertmanager-webhook-receiver.md). |
| **Logs**       | Loki + Promtail, queryable from the same Grafana instance.                                                                                                                                                                                        |
| **Backups**    | Automated daily/weekly/monthly Postgres dumps with a restore procedure that's actually been run end to end — see [`infra/backups/README.md`](infra/backups/README.md).                                                                            |
| **CD**         | Every push to `main`/`master` publishes a git-sha-tagged image to GHCR after CI passes.                                                                                                                                                           |

## API documentation

`GET /api/v1/docs` (Swagger UI) — the actual contract, generated from [`apps/api/openapi.yaml`](apps/api/openapi.yaml), covering every real route. This replaced a hand-maintained route table in this README that had quietly drifted out of sync with the code (missing five entire modules by the time anyone noticed) — see the contract itself for why that's the source of truth now, not this file.

## Architecture decisions

[`docs/architecture/adr/`](docs/architecture/adr/) — eight ADRs documenting real decisions already made in this codebase (soft archival over hard delete, the simulated-fleet scope boundary, the DI pattern, the two-datasource Grafana split, and more), written so the reasoning outlives whichever code comment it used to live in alone.

## Quickstart

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Generate a real `JWT_SECRET` and `ALERTMANAGER_WEBHOOK_SECRET` before doing anything else — the API refuses to boot with the placeholder values from `.env.example` (see [ADR-0002](docs/architecture/adr/0002-fail-closed-environment-validation.md)):

```bash
openssl rand -hex 32   # -> JWT_SECRET
openssl rand -hex 24   # -> ALERTMANAGER_WEBHOOK_SECRET (must match infra/alertmanager/alertmanager.yml)
```

```bash
npm install
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run db:seed              # bootstrap operator account + a handful of hand-written fixtures
npm run db:seed:history      # the full six-month history (apps/api/prisma/seed-history/)
npm run dev
```

- Web: http://localhost:3000 — sign in with the seed operator (`apps/api/.env` → `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`)
- API docs: http://localhost:4000/api/v1/docs

### Full observability stack

```bash
docker compose up --build
```

Brings up Postgres, the API (migrations run as a one-shot step first — see [ADR-0008](docs/architecture/adr/0008-advisory-locks-for-scheduler-safety.md) for why that matters under multiple replicas), Redis (shared rate-limit counters), Prometheus, Alertmanager, Loki/Promtail, Grafana (both dashboards + Loki datasource provisioned), and the automated-backup sidecar.

| Service      | URL                                                         |
| ------------ | ----------------------------------------------------------- |
| Grafana      | http://localhost:3001 (`admin` / `admin` unless overridden) |
| Prometheus   | http://localhost:9090                                       |
| Alertmanager | http://localhost:9093                                       |
| Loki         | http://localhost:3100                                       |

Verify the dashboards are actually showing data, not just that they loaded:

```bash
node scripts/check-dashboards.mjs
```

## Everyday scripts

| Command                               | Purpose                                                        |
| ------------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                         | API + web in parallel                                          |
| `npm run lint` / `typecheck` / `test` | Same three gates CI runs                                       |
| `npm run db:seed:history`             | Regenerate the six-month simulated fleet history               |
| `node scripts/check-dashboards.mjs`   | Fail loudly if any Grafana panel is silently returning no data |
| `npm run docker:dev`                  | Full stack with hot-reload bind mounts                         |

## Known gaps

Not hidden, tracked:

- No real secrets manager (Vault or a cloud equivalent) — secrets are environment variables today.
- No MFA on COMMANDER/ADMIN accounts.
- `/api/v1/metrics` and `/api/v1/docs` are unauthenticated (see `docs/SECURITY_AND_READINESS_REVIEW.md`).

See `CONTRIBUTING.md` before opening a PR, and `SECURITY.md` to report a vulnerability.
