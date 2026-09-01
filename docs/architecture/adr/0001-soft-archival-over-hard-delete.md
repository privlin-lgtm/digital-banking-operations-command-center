# ADR-0001: Soft archival over hard delete for services

## Status

Accepted

## Context

Deleting a `Service` row used to be a real `DELETE`. A decommissioned service still has years of `Metric`/`Incident`/`SlaRecord`/`Alert` history a bank must retain — hard-deleting the row cascade-deleted that history along with it. This was found as a real bug during this project's development (see the `service.delete` → `service.archive` fix), not designed in from the start.

## Decision

`Service.archivedAt: DateTime?` instead of a hard delete or an `isDeleted: Boolean`. Null means active. Archiving hides the service from the active catalog (`findMany` filters it out by default, with an explicit `includeArchived` opt-in) while every historical foreign key stays intact.

A timestamp instead of a boolean because it records _when_, not just _whether_ — the same pattern used for `FailureSimulation.stoppedAt`.

## Consequences

- Every query against `Service` that lists "active" services must remember to filter `archivedAt: null` — this is a real footgun the repository layer owns centrally so individual callers don't have to remember it.
- Archived services are not visible in the default catalog view but remain fully joinable for historical reporting, audit, and SLA trend queries.
- There is no un-archive endpoint today; re-activating a decommissioned service is a direct data operation, on the assumption that it's rare enough not to warrant its own workflow yet.
