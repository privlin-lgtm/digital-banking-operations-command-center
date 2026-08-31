import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
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
