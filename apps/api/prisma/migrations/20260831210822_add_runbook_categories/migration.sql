-- CreateEnum
CREATE TYPE "RunbookCategory" AS ENUM ('DATABASE', 'INFRASTRUCTURE', 'APPLICATION', 'SECURITY', 'MONITORING');

-- AlterEnum
ALTER TYPE "RunbookOutcome" ADD VALUE 'PENDING';

-- NOTE: deliberately not dropping "audit_logs_createdAt_brin_idx" and
-- "metrics_recordedAt_brin_idx" — see the same note in the
-- add_incident_management migration for why Prisma's diff engine proposes
-- this every time (they're raw-SQL indexes with no schema.prisma
-- declaration).

-- AlterTable
ALTER TABLE "runbooks" ADD COLUMN     "category" "RunbookCategory" NOT NULL DEFAULT 'INFRASTRUCTURE';

-- CreateIndex
CREATE INDEX "runbooks_category_idx" ON "runbooks"("category");
