-- CreateEnum
CREATE TYPE "RcaRootCauseCategory" AS ENUM ('HUMAN_ERROR', 'CONFIGURATION_CHANGE', 'CODE_DEFECT', 'INFRASTRUCTURE_FAILURE', 'THIRD_PARTY_DEPENDENCY', 'CAPACITY_LIMIT', 'PROCESS_GAP');

-- CreateEnum
CREATE TYPE "CorrectiveActionType" AS ENUM ('CORRECTIVE', 'PREVENTIVE');

-- NOTE: deliberately not dropping "audit_logs_createdAt_brin_idx" and
-- "metrics_recordedAt_brin_idx" — see the same note in earlier migrations
-- for why Prisma's diff engine proposes this every time.

-- AlterTable
ALTER TABLE "corrective_actions" ADD COLUMN     "type" "CorrectiveActionType" NOT NULL DEFAULT 'CORRECTIVE';

-- AlterTable
ALTER TABLE "rca_reports" ADD COLUMN     "rootCauseCategory" "RcaRootCauseCategory" NOT NULL DEFAULT 'PROCESS_GAP';
