# ADR-0008: Postgres advisory locks for multi-instance scheduler safety

## Status

Accepted

## Context

Three scheduled jobs run as in-process `setInterval` timers (`apps/api/src/server.ts`): the incident escalation sweep, the SLA rollup, and the failure-simulator tick. All three are documented as "correct on one instance" — running N replicas means N redundant executions per interval. The escalation sweep and SLA rollup are genuinely idempotent by construction (the sweep only acts on incidents actually due for escalation; the rollup upserts the same row), so redundant execution is wasted work, not a correctness bug.

The failure-simulator tick is not idempotent: it generates a new synthetic metric sample and unconditionally advances `tickCount` on every call. N replicas would ramp every active chaos scenario N times faster and could double-fire the alert or incident it's meant to demonstrate — a real correctness bug the production-readiness audit found by reading the other two jobs' own doc comments and noticing this one had no equivalent.

## Decision

Wrap the failure-simulator tick in a Postgres advisory lock (`pg_try_advisory_lock` / `pg_advisory_unlock`, keyed by an arbitrary stable constant) rather than an external scheduler or a distributed lock service. Postgres advisory locks are visible across every connection to the same database, so exactly one replica acquires the lock and actually ticks per interval regardless of how many replicas are running; the rest see `locked: false` and skip — which still counts as a successful run for `bankops_scheduler_last_success_timestamp`, since "someone else already has this" is the correct outcome, not a failure.

## Consequences

- This is a single-database-instance solution — it assumes all replicas share one Postgres, which is true today and would need revisiting if Postgres itself were ever sharded.
- The escalation sweep and SLA rollup were deliberately left as documented-idempotent rather than also wrapped in a lock — they don't need one, and adding one anyway would be defending against a problem that doesn't exist for them.
- The real, larger-scale answer (named in both jobs' own comments) is still to move scheduling to an external mechanism — a Kubernetes CronJob or a queue consumer with leader election — hitting an HTTP endpoint instead of relying on every instance's own timer. The advisory lock is the right-sized fix for "this needs to be correct today," not a replacement for that.
