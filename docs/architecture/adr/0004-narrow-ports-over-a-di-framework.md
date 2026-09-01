# ADR-0004: Narrow ports and a single composition root, no DI framework

## Status

Accepted

## Context

Every domain module (services, incidents, alerts, SLA, remediation, runbooks, RCA, the failure simulator) needs its dependencies injected for testability — a service class shouldn't import Prisma directly if a unit test is going to substitute a fake. The usual answer is a DI framework (InversifyJS, tsyringe, NestJS's own container).

## Decision

Plain constructor injection, wired by hand in one file (`apps/api/src/container.ts`), with each dependency expressed as the _narrowest interface the consumer actually needs_ rather than the full concrete type. `AlertsService` doesn't depend on `IncidentsService`; it depends on an `IncidentCreator` interface with one method, satisfied by `IncidentsService` at wiring time. Same pattern for `RemediationTrigger`, `ServiceLookup`, `MetricRecorder`, and others.

No framework, no decorators, no reflection metadata — `container.ts` is a single function that constructs everything in dependency order and returns the wired object graph.

## Consequences

- Unit tests inject hand-written fakes against these same narrow interfaces (`apps/api/tests/fakes/`) instead of mocking Prisma — a fake has real, readable behavior; a mock just describes what you expect to happen.
- Adding a new cross-module dependency (e.g. wiring `RemediationEngine` into `AlertsService` for auto-remediation) means adding one interface file and one line in `container.ts`, not a decorator or a registration call — but it does mean `container.ts` grows linearly with the module count, and construction order matters (a dependency must be built before whatever consumes it, enforced by nothing but the file's own top-to-bottom order).
- There is no lazy resolution or circular-dependency support a framework would give you for free — the codebase has stayed small enough that this hasn't mattered yet.
