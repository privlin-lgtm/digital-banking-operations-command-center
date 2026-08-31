-- CreateEnum
CREATE TYPE "AlertComparator" AS ENUM ('GREATER_THAN', 'LESS_THAN');

-- NOTE: deliberately not dropping "audit_logs_createdAt_brin_idx" and
-- "metrics_recordedAt_brin_idx" — see the same note in earlier migrations
-- for why Prisma's diff engine proposes this every time.

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "comparator" "AlertComparator" NOT NULL,
    "criticalThreshold" DOUBLE PRECISION,
    "highThreshold" DOUBLE PRECISION,
    "mediumThreshold" DOUBLE PRECISION,
    "lowThreshold" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_rules_isActive_idx" ON "alert_rules"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "alert_rules_serviceId_metricName_key" ON "alert_rules"("serviceId", "metricName");

-- CreateIndex
CREATE INDEX "services_archivedAt_idx" ON "services"("archivedAt");

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
