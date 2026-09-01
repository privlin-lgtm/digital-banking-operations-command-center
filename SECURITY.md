# Security

## Reporting a vulnerability

Email `security@bankops.internal` (internal alias — do not open a public issue for anything that isn't already public knowledge). Include reproduction steps and the affected version/commit. Expect an acknowledgment within one business day and a remediation timeline within five.

## Known findings and their status

Rather than re-describe the security posture here, the actual audit trail lives in:

- [`docs/SECURITY_AND_READINESS_REVIEW.md`](docs/SECURITY_AND_READINESS_REVIEW.md) — auth/authorization/dependency review, 5 findings fixed, 5 documented as accepted risk with reasoning.
- The production-readiness audit (interview artifact, not checked into this repo) — reliability/observability/scalability findings, all P0/P1 items closed as of this commit; two P2 items (a real secrets manager, MFA for privileged roles) remain open and are tracked, not silently dropped.

## Supported versions

This is an internal platform with one deployed target, not a library with a support matrix — the version running in each environment is whatever the latest successful CD run published (see `.github/workflows/cd.yml`). There is no backport policy; fixes go on top of the current `main`.

## What "secure" means for this specific platform

- `JWT_SECRET` cannot be a placeholder value in any environment — the app refuses to boot rather than silently accept one (see ADR-0002).
- `COOKIE_SECURE=false` cannot coexist with `NODE_ENV=production` — same fail-closed posture.
- Every state-changing action is attributed to a real actor in `AuditLog`, including automated ones (a reserved system-account user, never a nullable actor).
- Login is timing-safe (a dummy bcrypt comparison runs even when the account doesn't exist) and rate-limited separately from general API traffic, backed by Redis when running more than one replica.
