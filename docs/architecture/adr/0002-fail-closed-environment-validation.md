# ADR-0002: Fail closed on placeholder secrets and insecure-cookie-in-production

## Status

Accepted

## Context

A production-readiness audit found two related gaps: `JWT_SECRET` was validated only for length, so the literal placeholder value from `.env.example` (`replace-with-a-64-char-random-string`, sitting in this repo's git history in plaintext) would pass validation and boot successfully in any environment, including production. Separately, `COOKIE_SECURE=false` combined with `NODE_ENV=production` — an explicit contradiction meaning the session cookie can travel over plain HTTP — was allowed to boot silently.

Both are the same class of mistake: a config value that's individually well-typed but collectively means "this deployment is insecure," with nothing stopping it from reaching a real environment.

## Decision

`apps/api/src/config/env.ts` now refuses to start the process in either case:

- `JWT_SECRET` is checked against a list of known-placeholder substrings (`replace`, `changeme`, the literal example value, etc.) in **every** environment, not just production — a secret that happens to work in dev because nobody's exploited it yet is the exact setup that reaches production unnoticed.
- A Zod-level `.refine()` on the whole config object rejects `NODE_ENV === 'production' && !COOKIE_SECURE` as a single invalid combination, independent of either field's own validity.

## Consequences

- A fresh clone cannot run at all without generating a real secret (`openssl rand -hex 32`) — this is deliberate friction, not an oversight; the alternative is a working-by-accident default that eventually ships.
- Docker Compose's "production" profile now explicitly sets `COOKIE_SECURE: 'true'` to satisfy this guard.
- Any _future_ config value with the same "individually valid, collectively dangerous" shape should get the same treatment — a `.refine()` on the parsed object, not a comment asking someone to remember.
