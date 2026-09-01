# ADR-0009: Demo Mode drives real pipelines end-to-end instead of writing fabricated records

## Status

Accepted

## Context

Interview and stakeholder walkthroughs need a live, watchable incident happening — alerts firing, an incident opening, remediation running, the incident resolving, an RCA appearing — without waiting for a real production failure or hand-crafting Prisma rows that only _look_ like the real thing.

The tempting shortcut is a `DemoModeService` that directly inserts an `Incident`, an `Alert`, an `SlaRecord`, and an `RcaReport` on a timer. That would be fast to build and would demo fine, but it would be lying: every one of those tables already has a real write path (`AlertsService.evaluateMetric`, `IncidentsService`, `SlaTrackingService.runRollup`, `RcaService`), and a demo that bypasses them proves nothing about whether those paths actually work — exactly the gap the seed-history generator's `incidents-gen.ts` already has (see its own doc comments), just moved to runtime.

## Decision

`DemoModeService` (`apps/api/src/modules/demo-mode/`) never writes an Incident, Alert, SlaRecord, or RcaReport row directly. Its own database footprint is a single singleton state row (`DemoModeState`) tracking which of six narrative archetypes is running and which phase it's in. Everything a viewer sees is produced by calling the same real services a live monitoring agent, a commander, and an SRE would call:

- **Metrics** — `ServiceHealthService.recordMetric`, the same path `FailureSimulatorService` and a real telemetry agent use.
- **Alerts / incidents** — `AlertsService.evaluateMetric`, unmodified. A demo run only "wins" an incident by genuinely crossing a real, already-seeded `AlertRule`'s `criticalThreshold` (see `demo-scenarios.ts` — each of the six archetypes is pinned to the exact (service, metric) pair `ALERT_RULE_DEFS` already seeds real thresholds for).
- **Remediation** — the existing SEV1-auto-remediation trigger inside `evaluateMetric` (see ADR-0002's sibling P1 fix). Demo Mode doesn't call `RemediationEngine` itself; it made this observable by backfilling `autoRemediateAction` onto the six `AlertRule`s it drives, closing a real gap (none of the seeded rules had it set before).
- **Incident lifecycle** — `IncidentsService.acknowledge/mitigate/resolve`, the same state machine a human works through.
- **SLA** — `SlaTrackingService.runRollup`, recomputed from the incident's real `openedAt`/`resolvedAt` window, not set to a chosen number.
- **RCA** — `RcaService.create` → `submitForReview` → `approve`, respecting the real four-eyes rule (a second, real COMMANDER/ADMIN account reviews — never the same actor).

The one genuinely new mechanism is a bounded phase state machine (`IDLE → BASELINE → DEGRADING → INCIDENT → REMEDIATING → RESOLVED → RCA_REVIEW → COOLDOWN`) that decides _when_ to call each of the above, with randomized tick counts and jitter so two runs of the same archetype don't look identical.

### Why the primary metric snaps instead of climbing tier by tier

The first implementation ramped the primary metric smoothly through every severity tier (SEV4 → SEV3 → SEV2 → SEV1), which looked more realistic but never actually triggered an incident or remediation: `AlertsService.evaluateMetric` only auto-creates an incident, and only auto-triggers remediation, on a **brand-new firing transition** — a value that already breached a lower tier is "already firing" by the time it reaches `criticalThreshold`, so the eventual SEV1 is a reclassification, not a new incident (this is intentional, documented platform behavior — a commander is expected to reclassify an escalating incident's severity by hand, not have a second incident spawn). A gradual demo ramp defeated its own purpose.

The fix: the primary metric holds at a healthy baseline for every DEGRADING tick except the final one, where it jumps straight past `criticalThreshold` — guaranteeing the breach is a fresh firing at SEV1, so both incident-creation and remediation genuinely fire together. Correlated and synthetic metrics (which have no `AlertRule` of their own and so can't accidentally spawn a second incident) still ramp smoothly across the whole phase, so the dashboards still show a multi-signal, gradually-worsening incident even though the one metric actually gating automation snaps.

## Consequences

- A demo run is only as trustworthy as the real pipelines it drives — if `AlertsService` or `RcaService` ever regresses, Demo Mode breaks visibly instead of silently continuing to show fabricated success.
- Six archetypes, six fixed (service, metric) targets. Adding a seventh means adding a real `AlertRule` (or reusing an existing one) before it can be wired into `demo-scenarios.ts` — there's no shortcut to invent a rule on the fly.
- The "snap, don't climb" constraint means the primary metric's dashboard line looks less like a gradual real-world leak and more like a step function for every archetype, including `MEMORY_LEAK`. This is a genuine, documented limitation of the platform's own incident-auto-creation semantics, not a Demo Mode simplification — a real memory leak on this platform would show the same snap the first time it's automated end to end.
- Runtime-toggleable via `POST /api/v1/demo-mode/enable` (COMMANDER/ADMIN only), independent of the `FAILURE_SIMULATOR_TICK_INTERVAL_MS`-driven chaos-engineering harness it sits alongside — the two features share the tick-and-advisory-lock pattern (see `server.ts`) but not any state.
