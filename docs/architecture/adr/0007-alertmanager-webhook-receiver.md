# ADR-0007: A webhook receiver into the API, not a real Slack/PagerDuty integration

## Status

Accepted

## Context

A production-readiness audit's most severe finding was that nine well-designed Prometheus alerting rules had no delivery path at all — Alertmanager didn't exist in the stack, so a rule transitioning to `firing` was purely an internal Prometheus state change nobody outside its own UI would ever see.

The standard fix is Alertmanager routed to a real notification channel — Slack, PagerDuty, Opsgenie. This environment has no real credentials for any of them.

## Decision

Stand up real Alertmanager, routed to a webhook receiver inside the BankOps API itself (`POST /api/v1/internal/alerts/webhook`), authenticated by a bearer shared secret configured identically on both sides (Alertmanager's `http_config.authorization`, the API's `ALERTMANAGER_WEBHOOK_SECRET`). The receiver logs each notification at a level matching its severity and increments `bankops_alert_notifications_total` — a real, observable "did delivery happen" signal, verified end to end with an actual injected test alert, not just config that parses.

## Consequences

- This proves the _mechanism_ — routing, grouping, delivery, the receiving side's auth — completely honestly. It does not prove "a human gets paged," because nothing here texts or calls anyone.
- Swapping in a real `slack_configs` or `pagerduty_configs` receiver later is a change to `infra/alertmanager/alertmanager.yml` alone — the routing tree, grouping, and inhibition rules around it don't need to change.
- The webhook secret is a literal value in `alertmanager.yml` because Alertmanager's config format has no environment-variable expansion — it must be kept in sync by hand with the API's own `ALERTMANAGER_WEBHOOK_SECRET`. A real deployment injects both from the same secrets manager (see the audit's still-open "no secrets manager" finding).
