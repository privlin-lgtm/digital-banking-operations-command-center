-- NOTE: deliberately not dropping "audit_logs_createdAt_brin_idx" and
-- "metrics_recordedAt_brin_idx" — see the same note in earlier migrations
-- for why Prisma's diff engine proposes this every time.

-- AlterTable
ALTER TABLE "sla_records" ADD COLUMN     "avgResponseTimeMs" DECIMAL(10,2),
ADD COLUMN     "meanTimeToDetectMinutes" DECIMAL(10,2),
ADD COLUMN     "meanTimeToRecoverMinutes" DECIMAL(10,2);
