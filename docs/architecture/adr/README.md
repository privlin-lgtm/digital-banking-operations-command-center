# Architecture Decision Records

Each of these documents a decision already made in this codebase — not a proposal. Written retroactively where the reasoning previously lived only in a code comment, so it outlives whichever file that comment was in.

| ADR                                                          | Decision                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [0001](0001-soft-archival-over-hard-delete.md)               | Soft archival (`archivedAt`) over hard delete for services                       |
| [0002](0002-fail-closed-environment-validation.md)           | Fail closed on placeholder secrets / insecure-cookie-in-production               |
| [0003](0003-simulated-fleet-not-real-microservices.md)       | The 12-service fleet is simulated data, not real microservices                   |
| [0004](0004-narrow-ports-over-a-di-framework.md)             | Narrow ports and a single composition root, no DI framework                      |
| [0005](0005-two-datasource-grafana-architecture.md)          | Two Grafana datasources — Prometheus for live infra, Postgres for the fleet      |
| [0006](0006-brin-indexes-outside-prisma.md)                  | BRIN indexes on high-volume time columns, added outside Prisma                   |
| [0007](0007-alertmanager-webhook-receiver.md)                | A webhook receiver into the API, not a real Slack/PagerDuty integration          |
| [0008](0008-advisory-locks-for-scheduler-safety.md)          | Postgres advisory locks for multi-instance scheduler safety                      |
| [0009](0009-demo-mode-real-pipelines-not-fabricated-data.md) | Demo Mode drives real pipelines end-to-end instead of writing fabricated records |

## Writing a new one

Copy the shape of any existing ADR: Status, Context, Decision, Consequences. An ADR records a decision that was actually made and its real tradeoffs — including the ones that turned out to be limitations — not a design proposal or a wishlist.
