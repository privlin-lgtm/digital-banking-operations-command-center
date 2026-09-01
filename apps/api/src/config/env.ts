import 'dotenv/config';
import { z } from 'zod';

// Rejected outright, in every environment — not just production. A secret
// that merely satisfies a length check can still be the literal example
// value from .env.example, which is sitting in this repo's git history in
// plaintext. Letting that boot "successfully" in dev is exactly how it
// ends up unnoticed in a real deployment (see the production-readiness
// audit's P0 finding). Failing closed everywhere costs a fresh clone one
// `openssl rand -hex 32` and buys real protection.
const KNOWN_PLACEHOLDER_NEEDLES = [
  'replace-with-a-64-char-random-string',
  'replace',
  'changeme',
  'change-me',
  'your-secret',
  'placeholder',
  'example-secret',
];

function looksLikePlaceholderSecret(value: string): boolean {
  const lowered = value.toLowerCase();
  return KNOWN_PLACEHOLDER_NEEDLES.some((needle) => lowered.includes(needle));
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1),
    FRONTEND_ORIGIN: z.url(),
    JWT_SECRET: z
      .string()
      .min(32)
      .refine((value) => !looksLikePlaceholderSecret(value), {
        message:
          'JWT_SECRET looks like a placeholder (e.g. the literal .env.example value), not a real secret. ' +
          'Generate one with `openssl rand -hex 32` and set it before starting the server.',
      }),
    JWT_EXPIRES_IN: z.string().default('15m'),
    COOKIE_SECURE: z
      .string()
      .default('false')
      .transform((value) => value === 'true'),
    ALERTMANAGER_WEBHOOK_SECRET: z.string().min(16),
    // Unset = in-memory rate-limit counters, fine for a single instance and
    // for local dev. Every replica behind a load balancer counts
    // independently against an in-memory store, which silently multiplies
    // the effective limit by replica count — including the login
    // brute-force guard (see auth.router.ts). Set this to share counters
    // across replicas via Redis before running more than one.
    RATE_LIMIT_REDIS_URL: z.string().optional(),
    // 0 disables the in-process sweep entirely (tests, or a deployment that
    // triggers POST /incidents/escalations/sweep from an external scheduler
    // instead — see IncidentEscalationService.runSweep's scaling note).
    ESCALATION_SWEEP_INTERVAL_MS: z.coerce.number().int().min(0).default(60_000),
    // Recomputes the current month's SlaRecord for every service. Same
    // disable-for-external-scheduler reasoning as the escalation sweep, and
    // the same interval semantics — see SlaTrackingService.runRollup.
    SLA_ROLLUP_INTERVAL_MS: z.coerce.number().int().min(0).default(3_600_000),
    // Drives every currently-running FailureSimulation forward one tick —
    // short by design, since a chaos-engineering demo scenario should show
    // its metrics degrading in observable real time, not once an hour.
    FAILURE_SIMULATOR_TICK_INTERVAL_MS: z.coerce.number().int().min(0).default(15_000),
    SYSTEM_ACTOR_EMAIL: z.string().default('system@bankops.internal'),
  })
  // A production boot with the auth cookie NOT marked Secure is an explicit
  // contradiction, not a reasonable default — it means the session cookie
  // can travel over plain HTTP. Refuse to start rather than silently
  // running an insecure "production" deployment (see the production-
  // readiness audit's cookie-flag finding).
  .refine((env) => !(env.NODE_ENV === 'production' && !env.COOKIE_SECURE), {
    message:
      'COOKIE_SECURE must be true when NODE_ENV=production — refusing to serve the auth cookie over plain HTTP.',
    path: ['COOKIE_SECURE'],
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(): Env {
  if (cached) {
    return cached;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }

  cached = parsed.data;
  return cached;
}
