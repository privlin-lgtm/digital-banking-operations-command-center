# Contributing

## Before you open a PR

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
```

All four run in CI (`.github/workflows/ci.yml`) on every push and PR — running them locally first is just about not waiting for CI to tell you what you already knew.

## Testing philosophy

Unit tests use hand-written fakes (`apps/api/tests/fakes/`) against narrow-port interfaces, never a mocked Prisma client and never a real database. A fake has real, readable behavior; a mock just describes what you expect to happen. See `docs/architecture/adr/0004-narrow-ports-over-a-di-framework.md` for the pattern this supports.

If a change needs verification a unit test can't give — a scheduled job, an Alertmanager route, a Grafana panel — verify it against the live stack (`docker compose up --build`) before calling it done. `scripts/check-dashboards.mjs` exists specifically because "the PromQL looks right" and "the panel has data" turned out to be different claims twice in this project's history.

## Database migrations

`npx prisma migrate dev --create-only` first, review the generated SQL, **then** apply. Prisma's diff engine doesn't understand the raw-SQL BRIN indexes on `metrics.recordedAt` and `audit_logs.createdAt` (added outside the Prisma DSL) and proposes dropping them on every single migration since — strip those lines before applying, every time. See `docs/architecture/adr/0006-brin-indexes-outside-prisma.md`.

If you ever hand-edit a migration file _after_ it's already been applied, Prisma's history checksum will drift and `migrate dev` will want to reset the database on the next run. Fix the checksum in `_prisma_migrations` directly (`sha256sum` the file, `UPDATE _prisma_migrations SET checksum = ...`) rather than resetting — a reset on a database seeded with six months of history is not something to do by accident.

## Commit messages

Explain the why, not the what — the diff already shows what changed. If a change fixes something that was silently wrong (a label collision, a broken template variable, a stale README claim), say how it was actually verified fixed, not just that it was changed.

## Code review

See `CODEOWNERS` for who reviews what. A PR touching an audited action (anything a bank's compliance team would ask about) or alerting/on-call routing gets reviewed with that specifically in mind — see the PR template's Risk section.
