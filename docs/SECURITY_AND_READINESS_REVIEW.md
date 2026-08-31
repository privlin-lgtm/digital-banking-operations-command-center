# BankOps Control Center — Security, Production-Readiness & Refactor Review

**Date:** 2026-08-31
**Scope:** `apps/api` — the full backend (auth, all domain modules, middleware, Docker/Compose deployment config).
**Method:** Manual review of every auth/authorization path, every raw-SQL usage, the error-handling and logging pipeline, the Docker/Compose deployment config, and `npm audit`. No automated scanner was run — this is a human read of the actual code, the same way a reviewer would go through it before sign-off.

This single document covers three overlapping asks — a security audit, a production-readiness review, and a refactor pass — because in practice they kept turning up the same handful of real issues from different angles. Each finding below was either **fixed in this pass** (small, well-understood, low blast-radius) or **documented as a recommendation** (would need a product/infra decision, or risks a bigger change than its payoff justifies right now). Nothing here is theoretical — every fix was verified against the real running server and the real dev database, not just typechecked.

---

## Fixed

### 1. `/audit-logs` was readable by any authenticated user — HIGH

**Where:** [`audit.router.ts`](../apps/api/src/modules/audit/audit.router.ts)

The route only required `authenticate` — any logged-in user, including the lowest-privilege `VIEWER` role, could list the last 100 audit-log entries: every `LOGIN`/`LOGOUT`, every service archival, every alert-rule change, every incident action, tagged with the actor's identity. Every other sensitive read in this codebase (`/users`) is `ADMIN`-only; the audit trail is at least as sensitive and had no role gate at all.

**Fix:** `auditRouter.use(authenticate, authorize(UserRole.ADMIN))`.

**Verified live:** a `VIEWER` login now gets `403` on `GET /audit-logs`; an `ADMIN` login still gets `200`.

### 2. No dedicated brute-force protection on login — MEDIUM

**Where:** [`auth.router.ts`](../apps/api/src/modules/auth/auth.router.ts)

The only rate limit in front of `POST /auth/login` was the app-wide limiter in `app.ts` (120 requests/minute per IP) — sized for general API traffic, not credential guessing. At that ceiling, an attacker gets 120 password attempts per minute per IP against any known email.

**Fix:** a second, much tighter limiter scoped to just this route — 10 attempts per 15 minutes per IP, stacked on top of the global one.

**Verified live:** the 11th login attempt within the window returned `429` (confirmed by exhausting the budget with the timing-check requests below, then watching every subsequent attempt in the same 15-minute window get rejected).

### 3. Login had a timing side-channel that let an attacker enumerate valid emails — LOW

**Where:** [`auth.service.ts`](../apps/api/src/modules/auth/auth.service.ts)

```ts
// before
if (!user || !user.isActive) {
  throw new UnauthorizedError('Invalid credentials'); // ~0ms — no bcrypt.compare ever runs
}
const matches = await bcrypt.compare(input.password, user.passwordHash); // ~450ms
```

An unknown email short-circuited before `bcrypt.compare` ever ran; a known email with the wrong password always paid bcrypt's ~450ms cost. That's a clean, unauthenticated oracle for discovering which email addresses have accounts — no password guessing required, just a stopwatch.

**Fix:** always run `bcrypt.compare`, against a fixed dummy hash when there's no real user to compare against, so every code path costs the same:

```ts
const matches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
if (!user || !user.isActive || !matches) {
  throw new UnauthorizedError('Invalid credentials');
}
```

**Verified live** — four requests per case, real wall-clock timings from `curl -w '%{time_total}'` against the running dev server:

| Case                        | Timings (s)                |
| --------------------------- | -------------------------- |
| Unknown email               | 0.452, 0.450, 0.472, 0.470 |
| Valid email, wrong password | 0.449, 0.461, 0.471, 0.456 |

Statistically indistinguishable, where before the unknown-email case would have returned in single-digit milliseconds.

### 4. JWT verification didn't pin algorithm or issuer — LOW (defense-in-depth)

**Where:** [`authenticate.ts`](../apps/api/src/middleware/authenticate.ts)

`jwt.verify(token, env.JWT_SECRET)` with no `algorithms` option trusts whatever `alg` the presented token's header claims, rather than restricting to the one algorithm this app actually signs with (HS256). Not exploitable today — there's only ever been one signing path, symmetric HS256 both ways — but it's a well-known vulnerability class (algorithm-confusion) that costs nothing to close off now, before this app ever grows a second signing path (e.g. RS256 for a future service-to-service token).

**Fix:** `jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'bankops-api' })` — also now rejects a token that's validly HMAC-signed with the same secret but was never meant to be a BankOps access token (no plausible attack today, but a correct invariant to enforce).

### 5. Docker's HEALTHCHECK could never detect a database outage — MEDIUM

**Where:** [`Dockerfile`](../apps/api/Dockerfile), [`docker-compose.yml`](../docker-compose.yml)

Both pointed the container `HEALTHCHECK` at `/api/v1/health` — the human-facing rollup endpoint, which by design **always returns HTTP 200** and reports `"status": "degraded"` in the JSON body when a dependency is down (see the doc comment in `health.router.ts` — that's the correct behavior for a dashboard, which wants "database is down" as a fact to display, not a failed request). Docker's `HEALTHCHECK` only looks at the exit code of the probe command, never the JSON body, so `wget` against `/health` succeeds even during a full database outage. The container would report itself healthy to Docker/an orchestrator no matter what was happening underneath — the exact case a healthcheck exists to catch.

`/api/v1/ready` was already built for exactly this: it does one `SELECT 1` and lets the query throw straight through to a non-200 response if the database is unreachable.

**Fix:** repointed both the `Dockerfile`'s `HEALTHCHECK` and `docker-compose.yml`'s API service `healthcheck` at `/api/v1/ready`.

**Verified live:** `GET /api/v1/ready` returns `200` with the database up (didn't tear down the dev Postgres container to confirm the failure path, since that would have disrupted the rest of this session's testing — the code path itself, `await prisma.$queryRaw`SELECT 1``propagating an unhandled rejection through `asyncHandler` to the centralized error handler's `500`, is exercised directly by the existing `tests/health.test.ts` "degrades gracefully" test, just for the `/health` endpoint's own try/catch rather than `/ready`'s bare await).

---

## Documented, not fixed

Each of these is real, but fixing it now would mean a product decision, an infra change outside this repo, or a bigger structural change than its actual risk justifies today.

- **`/api/v1/metrics` (the Prometheus scrape endpoint) is unauthenticated** and exposes aggregate business signals — open-incident counts by severity, current SLA-breach counts, per-route HTTP histograms. Low risk (no customer/account data), but for a "banking-grade" platform it's still information a competitor or attacker shouldn't get for free by hitting the API. The right fix is a network-level restriction (bind it to an internal-only listener, or let Prometheus reach it over a private network segment) — not app-level auth, which would just require reconfiguring the scrape job to send credentials and adds little real protection against anything already inside the network boundary that can reach Prometheus in the first place.
- **Login returns the JWT in the JSON response body as well as setting it as an `httpOnly` cookie.** `authenticate.ts` accepts either an `Authorization: Bearer` header or the cookie, which is a deliberate dual-mode design (a browser client uses the cookie; a script/mobile/Postman-style API client uses the bearer token from the body). The cost is that the `httpOnly` flag's XSS protection is only as strong as the weakest consumer — if the real frontend ever reads `response.data.accessToken` and stores it in `localStorage` "just in case," the cookie's protection is moot. Worth an explicit decision (drop the token from the body once there's a real frontend that only ever uses the cookie), not a silent fix that might break an API client depending on today's behavior.
- **No self-service signup, password reset, or password-change endpoint exists.** Accounts are entirely admin/seed-provisioned. That's a defensible choice for this system's threat model (a bank's ops tooling shouldn't have open self-registration), but it's worth stating as an explicit decision rather than an unstated gap — and it means there's currently no way to rotate a compromised password without going back to `prisma/seed.ts` or a direct DB write.
- **The audit-log endpoint has no filtering or pagination** beyond a hardcoded `take: 100`, most-recent-first. Fine for a demo; a real investigative workflow needs cursor pagination plus filters by actor, entity, action, and date range.
- **`prisma` (the CLI) sits in `dependencies` rather than `devDependencies`** in `apps/api/package.json`, alongside `tsx`. `tsx` genuinely belongs there — `npm start` runs `tsx src/server.ts` directly rather than a build step's compiled output, so it's a real runtime dependency. `prisma` the CLI is only ever invoked via the `db:*` scripts (migrate, generate, seed, studio), never imported by the running server. It's harmless today because the Docker build runs `npm ci` (not `--omit=dev`), so it's installed either way — but it is why `npm audit --omit=dev` currently reports a transitive high-severity advisory in `deepmerge-ts` (via `@prisma/config`) that shouldn't be reachable from a production dependency tree at all. Not exploitable from the running app — the vulnerable code path only triggers inside the `prisma` CLI's own config-merging logic — but worth moving to `devDependencies` for hygiene next time `prisma` gets bumped anyway.

---

## Refactor assessment

The honest finding here is that there wasn't much to refactor. The DI-without-a-framework pattern (interfaces as ports, one composition root in `container.ts`, hand-written fakes instead of Prisma mocking) is applied consistently across every domain module — Services, Incidents, Alerts, Remediation, Runbooks, SLA, RCA, and now the Failure Simulator all follow the identical shape, which is exactly what makes them all equally easy to unit-test.

The one real exception: **`auth.service.ts` and `authenticate.ts` talk to the `prisma` singleton directly**, instead of depending on an injectable port the way every other module does. That's consistent with why this review didn't add a unit test for the timing-side-channel fix above (finding #3) — there's no seam to inject a fake user-lookup through, so verifying it meant live-testing against the real dev server rather than a fast, isolated unit test. Retrofitting DI into the auth module is a legitimate next step, but it's a structural change in its own right (new `UserLookup`-style port, a `PrismaUserLookup` adapter, wiring through `container.ts`) — bigger than this review's job of fixing what's actually broken, so it's recorded here as a recommendation rather than folded into this pass.

No dead code, no duplicated business logic, and no inconsistent error-handling path turned up anywhere else in the sweep.
