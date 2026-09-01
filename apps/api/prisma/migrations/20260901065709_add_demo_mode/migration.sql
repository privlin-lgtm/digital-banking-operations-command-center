-- CreateEnum
CREATE TYPE "DemoScenario" AS ENUM ('DATABASE_OUTAGE', 'DEPENDENCY_FAILURE', 'LATENCY_SPIKE', 'DEPLOYMENT_FAILURE', 'MEMORY_LEAK', 'THIRD_PARTY_OUTAGE');

-- CreateEnum
CREATE TYPE "DemoPhase" AS ENUM ('IDLE', 'BASELINE', 'DEGRADING', 'INCIDENT', 'REMEDIATING', 'RESOLVED', 'RCA_REVIEW', 'COOLDOWN');

-- CreateEnum
CREATE TYPE "DemoIntensity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- NOTE: deliberately not dropping "audit_logs_createdAt_brin_idx" and
-- "metrics_recordedAt_brin_idx" — see the same note in earlier migrations
-- (Prisma's diff engine proposes dropping them every time because they were
-- added by raw SQL, outside anything the Prisma DSL can express; see
-- ADR-0006).

-- CreateTable
CREATE TABLE "demo_mode_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "autoLoop" BOOLEAN NOT NULL DEFAULT true,
    "intensity" "DemoIntensity" NOT NULL DEFAULT 'MEDIUM',
    "phase" "DemoPhase" NOT NULL DEFAULT 'IDLE',
    "scenario" "DemoScenario",
    "lastScenario" "DemoScenario",
    "serviceId" TEXT,
    "incidentId" TEXT,
    "alertId" TEXT,
    "rcaReportId" TEXT,
    "phaseStartedAt" TIMESTAMP(3),
    "ticksInPhase" INTEGER NOT NULL DEFAULT 0,
    "phaseTargetTicks" INTEGER NOT NULL DEFAULT 0,
    "startedById" TEXT,
    "startedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_mode_state_pkey" PRIMARY KEY ("id")
);
