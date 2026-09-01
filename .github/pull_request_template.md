## What changed and why

<!-- The "why" matters more than the "what" here — the diff already shows what changed. -->

## How was this verified?

- [ ] `npm run typecheck && npm run lint && npm test` pass locally
- [ ] Exercised against the live stack (not just unit tests), if this touches a route, a scheduled job, or infra config
- [ ] Migration reviewed for the spurious BRIN-index drops Prisma's diff engine proposes (see `docs/architecture/adr/`) before merging, if this touches `schema.prisma`

## Risk

- [ ] Reversible (a bad deploy can be rolled back to the previous image tag with no data loss)
- [ ] Touches an audited action (anything a bank's compliance team would ask about) — reviewed with that lens specifically
- [ ] Touches alerting thresholds or on-call routing — reviewed by someone who isn't the author

## Screenshots / dashboard evidence

<!-- For anything observable — a new metric, a dashboard change, an alert rule — a screenshot or a pasted PromQL/SQL result belongs here. "It looks right in the code" is not the same claim as "it looks right in Grafana." -->
