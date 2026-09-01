# ADR-0006: BRIN indexes on high-volume time columns, added outside the Prisma DSL

## Status

Accepted

## Context

`Metric.recordedAt` and `AuditLog.createdAt` are the two highest-volume, append-only, naturally-time-ordered columns in the schema (six months of history is already 300K+ metric rows). A B-tree index on either would be large and mostly redundant with the physical insert order; a BRIN (Block Range) index is a much smaller, cheaper index that exploits exactly that correlation between insert order and physical storage.

Prisma's schema DSL has no syntax for `USING BRIN` — only B-tree-equivalent `@@index`.

## Decision

Both BRIN indexes are added via raw SQL inside their respective migration files, outside anything the Prisma DSL can express, with a comment explaining why.

## Consequences

- Prisma's migration diff engine doesn't know these indexes exist from the schema file's perspective and proposes `DROP INDEX` for both on **every single migration since** — this has been true across at least seven consecutive migrations. The fix is the same every time: strip the two `DROP INDEX` lines before applying, confirmed via `prisma migrate dev --create-only` (which lets you review before it touches the database) rather than the auto-applying `migrate dev`.
- If a migration file is hand-edited _after_ it was already applied (exactly this edit, every time), Prisma's stored checksum for that migration drifts from the file on disk, and the next `migrate dev` will refuse to proceed and offer to reset the database. The recovery is to recompute the file's SHA-256 and update `_prisma_migrations.checksum` directly — documented in `CONTRIBUTING.md` — not to accept the reset.
- A genuine fix would be a `prisma.config.ts`-level customization or a post-migration hook that re-asserts these two indexes automatically; this hasn't been worth building for two indexes that change this rarely.
