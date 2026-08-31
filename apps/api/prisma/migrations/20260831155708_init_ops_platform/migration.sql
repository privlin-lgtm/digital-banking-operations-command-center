-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COMMANDER', 'RESPONDER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ServiceTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3', 'TIER_4');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'CRITICAL', 'MAINTENANCE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('HARD', 'SOFT');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('SEV1', 'SEV2', 'SEV3', 'SEV4');

-- CreateEnum
CREATE TYPE "AlertState" AS ENUM ('FIRING', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'MITIGATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RcaStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED');

-- CreateEnum
CREATE TYPE "RunbookOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "SlaWindow" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tier" "ServiceTier" NOT NULL DEFAULT 'TIER_2',
    "ownerTeam" TEXT NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_dependencies" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "dependsOnServiceId" TEXT NOT NULL,
    "dependencyType" "DependencyType" NOT NULL DEFAULT 'HARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" BIGSERIAL NOT NULL,
    "serviceId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "incidentId" TEXT,
    "ruleName" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "state" "AlertState" NOT NULL DEFAULT 'FIRING',
    "fingerprint" TEXT NOT NULL,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "primaryServiceId" TEXT NOT NULL,
    "commanderId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runbooks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "triggerCondition" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_runbooks" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "runbookId" TEXT NOT NULL,
    "runbookVersion" INTEGER NOT NULL,
    "executedById" TEXT,
    "executedAutomatically" BOOLEAN NOT NULL DEFAULT false,
    "outcome" "RunbookOutcome" NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_runbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rca_reports" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "rootCause" TEXT NOT NULL,
    "contributingFactors" TEXT,
    "authoredById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "RcaStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rca_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_actions" (
    "id" TEXT NOT NULL,
    "rcaReportId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_records" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "windowType" "SlaWindow" NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "targetPercent" DECIMAL(5,2) NOT NULL,
    "actualPercent" DECIMAL(5,2) NOT NULL,
    "errorBudgetMinutes" DECIMAL(10,2) NOT NULL,
    "errorBudgetConsumedMinutes" DECIMAL(10,2) NOT NULL,
    "breached" BOOLEAN NOT NULL DEFAULT false,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeState" JSONB,
    "afterState" JSONB,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "services_name_key" ON "services"("name");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_tier_status_idx" ON "services"("tier", "status");

-- CreateIndex
CREATE INDEX "service_dependencies_dependsOnServiceId_idx" ON "service_dependencies"("dependsOnServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "service_dependencies_serviceId_dependsOnServiceId_key" ON "service_dependencies"("serviceId", "dependsOnServiceId");

-- CreateIndex
CREATE INDEX "metrics_serviceId_metricName_recordedAt_idx" ON "metrics"("serviceId", "metricName", "recordedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "metrics_serviceId_metricName_recordedAt_key" ON "metrics"("serviceId", "metricName", "recordedAt");

-- CreateIndex
CREATE INDEX "alerts_serviceId_firedAt_idx" ON "alerts"("serviceId", "firedAt" DESC);

-- CreateIndex
CREATE INDEX "alerts_incidentId_idx" ON "alerts"("incidentId");

-- CreateIndex
CREATE INDEX "alerts_state_severity_idx" ON "alerts"("state", "severity");

-- CreateIndex
CREATE INDEX "incidents_status_severity_idx" ON "incidents"("status", "severity");

-- CreateIndex
CREATE INDEX "incidents_primaryServiceId_openedAt_idx" ON "incidents"("primaryServiceId", "openedAt" DESC);

-- CreateIndex
CREATE INDEX "incidents_commanderId_idx" ON "incidents"("commanderId");

-- CreateIndex
CREATE UNIQUE INDEX "runbooks_slug_key" ON "runbooks"("slug");

-- CreateIndex
CREATE INDEX "runbooks_isActive_idx" ON "runbooks"("isActive");

-- CreateIndex
CREATE INDEX "incident_runbooks_incidentId_idx" ON "incident_runbooks"("incidentId");

-- CreateIndex
CREATE INDEX "incident_runbooks_runbookId_idx" ON "incident_runbooks"("runbookId");

-- CreateIndex
CREATE UNIQUE INDEX "rca_reports_incidentId_key" ON "rca_reports"("incidentId");

-- CreateIndex
CREATE INDEX "rca_reports_status_idx" ON "rca_reports"("status");

-- CreateIndex
CREATE INDEX "corrective_actions_rcaReportId_idx" ON "corrective_actions"("rcaReportId");

-- CreateIndex
CREATE INDEX "corrective_actions_ownerId_isComplete_idx" ON "corrective_actions"("ownerId", "isComplete");

-- CreateIndex
CREATE INDEX "sla_records_serviceId_windowType_windowStart_idx" ON "sla_records"("serviceId", "windowType", "windowStart" DESC);

-- CreateIndex
CREATE INDEX "sla_records_breached_idx" ON "sla_records"("breached");

-- CreateIndex
CREATE UNIQUE INDEX "sla_records_serviceId_windowType_windowStart_key" ON "sla_records"("serviceId", "windowType", "windowStart");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_dependsOnServiceId_fkey" FOREIGN KEY ("dependsOnServiceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_primaryServiceId_fkey" FOREIGN KEY ("primaryServiceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_commanderId_fkey" FOREIGN KEY ("commanderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runbooks" ADD CONSTRAINT "runbooks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_runbooks" ADD CONSTRAINT "incident_runbooks_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_runbooks" ADD CONSTRAINT "incident_runbooks_runbookId_fkey" FOREIGN KEY ("runbookId") REFERENCES "runbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_runbooks" ADD CONSTRAINT "incident_runbooks_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rca_reports" ADD CONSTRAINT "rca_reports_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rca_reports" ADD CONSTRAINT "rca_reports_authoredById_fkey" FOREIGN KEY ("authoredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rca_reports" ADD CONSTRAINT "rca_reports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_rcaReportId_fkey" FOREIGN KEY ("rcaReportId") REFERENCES "rca_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_records" ADD CONSTRAINT "sla_records_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-authored additions: constraints Prisma's schema DSL cannot express.
-- Kept in the generated migration (rather than a follow-up one) since this
-- is the baseline — nothing has shipped from the old schema yet.
-- ---------------------------------------------------------------------------

-- A service cannot depend on itself.
ALTER TABLE "service_dependencies"
  ADD CONSTRAINT "service_dependencies_no_self_reference"
  CHECK ("serviceId" <> "dependsOnServiceId");

-- Partial unique index: the same alert rule can only have one FIRING alert
-- open per service at a time. Prisma's @@unique cannot carry a WHERE clause,
-- so Alertmanager's own dedupe is backed here at the database level too —
-- a duplicate webhook delivery cannot create a second open alert row.
CREATE UNIQUE INDEX "alerts_service_rule_firing_uq"
  ON "alerts" ("serviceId", "ruleName")
  WHERE "state" = 'FIRING';

-- BRIN indexes for the two append-only, time-ordered tables. A BRIN index
-- on a monotonically-inserted timestamp column costs kilobytes (not the
-- megabytes-per-million-rows a B-tree costs) because it stores per-block
-- min/max ranges instead of one entry per row — the right trade for a
-- column that is always scanned by range ("last 24h", "this month") and
-- never looked up by exact equality. See the Database Architecture doc's
-- "Scalability" section for the partitioning follow-up once these tables
-- outgrow a single BRIN-indexed table.
CREATE INDEX "metrics_recordedAt_brin_idx"
  ON "metrics" USING BRIN ("recordedAt");

CREATE INDEX "audit_logs_createdAt_brin_idx"
  ON "audit_logs" USING BRIN ("createdAt");
