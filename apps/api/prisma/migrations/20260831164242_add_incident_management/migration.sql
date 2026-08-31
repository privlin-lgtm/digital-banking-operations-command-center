-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('CREATED', 'SEVERITY_CHANGED', 'ASSIGNED', 'ACKNOWLEDGED', 'MITIGATED', 'RESOLVED', 'REOPENED', 'CLOSED', 'ESCALATED');

-- NOTE: Prisma's diff engine proposed dropping "audit_logs_createdAt_brin_idx"
-- and "metrics_recordedAt_brin_idx" here because they were added by raw SQL
-- in a previous migration and aren't declared in schema.prisma (Prisma has
-- no way to express a BRIN index in its DSL — see that migration's notes).
-- Deliberately NOT dropping them; every future migration needs the same
-- check for this pair, since they'll keep showing up as "drift" otherwise.

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "escalationLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastEscalatedAt" TIMESTAMP(3),
ADD COLUMN     "resolutionSummary" TEXT;

-- CreateTable
CREATE TABLE "incident_timeline_events" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "type" "TimelineEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_comments" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_timeline_events_incidentId_createdAt_idx" ON "incident_timeline_events"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "incident_comments_incidentId_createdAt_idx" ON "incident_comments"("incidentId", "createdAt");

-- AddForeignKey
ALTER TABLE "incident_timeline_events" ADD CONSTRAINT "incident_timeline_events_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timeline_events" ADD CONSTRAINT "incident_timeline_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_comments" ADD CONSTRAINT "incident_comments_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_comments" ADD CONSTRAINT "incident_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
