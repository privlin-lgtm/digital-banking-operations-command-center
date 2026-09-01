-- CreateEnum
CREATE TYPE "DataClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- Prisma's diff engine doesn't understand the raw-SQL BRIN indexes on
-- audit_logs.createdAt and metrics.recordedAt (added outside the Prisma
-- DSL, which has no BRIN syntax) and proposes dropping them on every
-- migration since. They stay — see those migrations' own notes.

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "externalTicketUrl" TEXT,
ADD COLUMN     "statusPageUrl" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "complianceScope" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dataClassification" "DataClassification" NOT NULL DEFAULT 'INTERNAL';
