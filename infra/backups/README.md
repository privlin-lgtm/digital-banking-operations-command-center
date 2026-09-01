# Postgres backup & restore

Closes the "no backup or restore strategy" P1 finding from the production-readiness audit. The `postgres-backup` service in `docker-compose.yml` runs [`prodrigestivill/postgres-backup-local`](https://github.com/prodrigestivill/docker-postgres-backup-local), which takes a `pg_dump` on the configured `SCHEDULE` (daily by default) and rotates dumps into daily/weekly/monthly tiers under the `postgres_backups` named volume.

This is a real, working local backup — not a documented intention. It has been exercised end-to-end (dump → drop → restore → verify row counts) against this exact compose stack.

## Where backups live

Inside the `postgres_backups` volume, under `daily/`, `weekly/`, and `monthly/` directories, as gzipped SQL dumps named `bankops-<timestamp>.sql.gz`.

```bash
docker compose exec postgres-backup ls -la /backups/daily
```

## Taking a manual backup right now

Don't wait for the schedule — the same image can be told to back up immediately:

```bash
docker compose exec postgres-backup /backup.sh
```

## Restoring — the procedure that was actually run to verify this works

1. Copy the dump you want out of the container:
   ```bash
   docker compose cp postgres-backup:/backups/daily/<file>.sql.gz ./restore.sql.gz
   gunzip restore.sql.gz
   ```
2. Restore into a **scratch database first** — never restore directly over a database you might still need:
   ```bash
   docker compose exec -T postgres psql -U bankops -c "DROP DATABASE IF EXISTS bankops_restore_test;"
   docker compose exec -T postgres psql -U bankops -c "CREATE DATABASE bankops_restore_test;"
   docker compose exec -T postgres psql -U bankops -d bankops_restore_test < restore.sql
   ```
3. Verify row counts against the live database before trusting the dump:
   ```bash
   docker compose exec -T postgres psql -U bankops -d bankops_restore_test -c "SELECT count(*) FROM incidents;"
   docker compose exec -T postgres psql -U bankops -d bankops -c "SELECT count(*) FROM incidents;"
   ```
4. Only once verified: restoring over the real database means stopping the API first (it holds open connections), dropping and recreating `bankops`, then restoring into it — do this deliberately, not as a reflex.

## What this does not cover

- **Off-host durability.** Dumps live in a Docker volume on the same host as the database they're backing up. A disk failure takes out both. A real deployment ships these to S3/GCS/Azure Blob (the backup image supports this directly via `BACKUP_TO_S3`-style env vars) — wiring a real bucket needs real cloud credentials this local environment doesn't have.
- **Point-in-time recovery.** These are periodic full dumps, not continuous WAL archiving — recovery granularity is "as of the last successful dump," not "as of any point in time." WAL-G or pgBackRest is the upgrade path once continuous recovery matters.
- **Automated restore testing.** The procedure above was run once, by hand, to prove it works — it is not re-verified automatically. A real operation would run this as a scheduled drill, not just document that it's possible.
