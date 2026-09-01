-- Prisma's diff engine doesn't understand the raw-SQL BRIN indexes on
-- audit_logs.createdAt and metrics.recordedAt (added outside the Prisma
-- DSL, which has no BRIN syntax) and proposes dropping them on every
-- migration since. They stay — see those migrations' own notes.

-- AlterTable
ALTER TABLE "alert_rules" ADD COLUMN     "autoRemediateAction" TEXT;
