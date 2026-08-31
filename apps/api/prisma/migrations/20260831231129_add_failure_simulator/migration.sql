-- CreateEnum
CREATE TYPE "FailureScenario" AS ENUM ('DATABASE_OUTAGE', 'NETWORK_LATENCY', 'MEMORY_LEAK', 'CPU_SPIKE', 'SERVICE_DEGRADATION', 'THIRD_PARTY_API_FAILURE');

-- NOTE: deliberately not dropping "audit_logs_createdAt_brin_idx" and
-- "metrics_recordedAt_brin_idx" — see the same note in earlier migrations
-- for why Prisma's diff engine proposes this every time.

-- CreateTable
CREATE TABLE "failure_simulations" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "scenario" "FailureScenario" NOT NULL,
    "tickCount" INTEGER NOT NULL DEFAULT 0,
    "startedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),

    CONSTRAINT "failure_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "failure_simulations_serviceId_idx" ON "failure_simulations"("serviceId");

-- CreateIndex
CREATE INDEX "failure_simulations_stoppedAt_idx" ON "failure_simulations"("stoppedAt");

-- AddForeignKey
ALTER TABLE "failure_simulations" ADD CONSTRAINT "failure_simulations_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_simulations" ADD CONSTRAINT "failure_simulations_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
