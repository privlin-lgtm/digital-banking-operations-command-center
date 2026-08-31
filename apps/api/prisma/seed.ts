import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function upsertUser(email: string, name: string, role: UserRole, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role, isActive: true },
    create: { email, name, passwordHash, role, isActive: true },
  });
}

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'oscar.d@example.net';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Admin1';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Platform Admin';

  const admin = await upsertUser(adminEmail, adminName, UserRole.ADMIN, adminPassword);
  const commander = await upsertUser(
    'dana.commander@example.net',
    'Dana Cohen',
    UserRole.COMMANDER,
    'ChangeMe!Commander1',
  );
  const responder = await upsertUser(
    'yossi.responder@example.net',
    'Yossi Levi',
    UserRole.RESPONDER,
    'ChangeMe!Responder1',
  );
  await upsertUser('noa.viewer@example.net', 'Noa Bar', UserRole.VIEWER, 'ChangeMe!Viewer1');

  const coreBanking = await prisma.service.upsert({
    where: { slug: 'core-banking-api' },
    update: {},
    create: {
      name: 'Core Banking API',
      slug: 'core-banking-api',
      tier: 'TIER_1',
      ownerTeam: 'Core Platform',
      status: 'HEALTHY',
    },
  });

  const authService = await prisma.service.upsert({
    where: { slug: 'auth-service' },
    update: {},
    create: {
      name: 'Auth Service',
      slug: 'auth-service',
      tier: 'TIER_1',
      ownerTeam: 'Identity',
      status: 'HEALTHY',
    },
  });

  const paymentsGateway = await prisma.service.upsert({
    where: { slug: 'payments-gateway' },
    update: {},
    create: {
      name: 'Payments Gateway',
      slug: 'payments-gateway',
      tier: 'TIER_1',
      ownerTeam: 'Payments',
      status: 'DEGRADED',
    },
  });

  const ledgerSync = await prisma.service.upsert({
    where: { slug: 'ledger-sync' },
    update: {},
    create: {
      name: 'Ledger Sync',
      slug: 'ledger-sync',
      tier: 'TIER_2',
      ownerTeam: 'Core Platform',
      status: 'CRITICAL',
    },
  });

  await prisma.serviceDependency.upsert({
    where: {
      serviceId_dependsOnServiceId: {
        serviceId: paymentsGateway.id,
        dependsOnServiceId: coreBanking.id,
      },
    },
    update: {},
    create: {
      serviceId: paymentsGateway.id,
      dependsOnServiceId: coreBanking.id,
      dependencyType: 'HARD',
    },
  });
  await prisma.serviceDependency.upsert({
    where: {
      serviceId_dependsOnServiceId: {
        serviceId: paymentsGateway.id,
        dependsOnServiceId: authService.id,
      },
    },
    update: {},
    create: {
      serviceId: paymentsGateway.id,
      dependsOnServiceId: authService.id,
      dependencyType: 'SOFT',
    },
  });
  await prisma.serviceDependency.upsert({
    where: {
      serviceId_dependsOnServiceId: {
        serviceId: ledgerSync.id,
        dependsOnServiceId: coreBanking.id,
      },
    },
    update: {},
    create: {
      serviceId: ledgerSync.id,
      dependsOnServiceId: coreBanking.id,
      dependencyType: 'HARD',
    },
  });

  const now = new Date();
  await prisma.metric.upsert({
    where: {
      serviceId_metricName_recordedAt: {
        serviceId: coreBanking.id,
        metricName: 'availability',
        recordedAt: now,
      },
    },
    update: {},
    create: {
      serviceId: coreBanking.id,
      metricName: 'availability',
      value: 99.98,
      unit: 'percent',
      recordedAt: now,
    },
  });
  await prisma.metric.upsert({
    where: {
      serviceId_metricName_recordedAt: {
        serviceId: ledgerSync.id,
        metricName: 'sync_lag_seconds',
        recordedAt: now,
      },
    },
    update: {},
    create: {
      serviceId: ledgerSync.id,
      metricName: 'sync_lag_seconds',
      value: 342,
      unit: 'seconds',
      recordedAt: now,
    },
  });

  // --- Runbook -------------------------------------------------------------
  const restartRunbook = await prisma.runbook.upsert({
    where: { slug: 'restart-ledger-sync-worker' },
    update: {},
    create: {
      title: 'Restart Ledger Sync Worker',
      slug: 'restart-ledger-sync-worker',
      triggerCondition: 'sync_lag_seconds > 120 for 5m',
      steps: [
        { order: 1, action: 'scale_down', target: 'ledger-sync-worker', replicas: 0 },
        { order: 2, action: 'flush_queue', target: 'ledger-sync-dlq' },
        { order: 3, action: 'scale_up', target: 'ledger-sync-worker', replicas: 2 },
      ],
      version: 1,
      isActive: true,
      createdById: admin.id,
    },
  });

  // --- Incident A: open, in progress, from a firing alert -------------------
  const ledgerAlert = await prisma.alert.upsert({
    where: { id: 'seed-alert-ledger-001' },
    update: {},
    create: {
      id: 'seed-alert-ledger-001',
      serviceId: ledgerSync.id,
      ruleName: 'sync_lag_high',
      severity: 'SEV2',
      state: 'FIRING',
      fingerprint: 'sync_lag_high:ledger-sync',
    },
  });

  const ledgerIncident = await prisma.incident.upsert({
    where: { id: 'seed-incident-ledger-001' },
    update: {},
    create: {
      id: 'seed-incident-ledger-001',
      title: 'Ledger sync falling behind on outbound settlement batch',
      severity: 'SEV2',
      status: 'ACKNOWLEDGED',
      primaryServiceId: ledgerSync.id,
      commanderId: commander.id,
      acknowledgedAt: now,
    },
  });

  await prisma.alert.update({
    where: { id: ledgerAlert.id },
    data: { incidentId: ledgerIncident.id },
  });

  await prisma.incidentRunbook.upsert({
    where: { id: 'seed-run-ledger-001' },
    update: {},
    create: {
      id: 'seed-run-ledger-001',
      incidentId: ledgerIncident.id,
      runbookId: restartRunbook.id,
      runbookVersion: restartRunbook.version,
      executedById: responder.id,
      executedAutomatically: false,
      outcome: 'PARTIAL',
    },
  });

  // --- Incident B: resolved, with a published RCA ---------------------------
  const paymentsAlert = await prisma.alert.upsert({
    where: { id: 'seed-alert-payments-001' },
    update: {},
    create: {
      id: 'seed-alert-payments-001',
      serviceId: paymentsGateway.id,
      ruleName: 'error_rate_high',
      severity: 'SEV1',
      state: 'RESOLVED',
      fingerprint: 'error_rate_high:payments-gateway',
      resolvedAt: now,
    },
  });

  const paymentsIncident = await prisma.incident.upsert({
    where: { id: 'seed-incident-payments-001' },
    update: {},
    create: {
      id: 'seed-incident-payments-001',
      title: 'Elevated 5xx rate on outbound wire submission',
      severity: 'SEV1',
      status: 'CLOSED',
      primaryServiceId: paymentsGateway.id,
      commanderId: commander.id,
      acknowledgedAt: now,
      resolvedAt: now,
      closedAt: now,
    },
  });

  await prisma.alert.update({
    where: { id: paymentsAlert.id },
    data: { incidentId: paymentsIncident.id },
  });

  const rca = await prisma.rcaReport.upsert({
    where: { incidentId: paymentsIncident.id },
    update: {},
    create: {
      incidentId: paymentsIncident.id,
      rootCause:
        'Connection pool exhaustion against Core Banking API after a deploy reduced max pool size.',
      contributingFactors:
        'No alert existed on pool saturation; the regression shipped without a load test.',
      authoredById: responder.id,
      reviewedById: commander.id,
      status: 'APPROVED',
      publishedAt: now,
    },
  });

  await prisma.correctiveAction.upsert({
    where: { id: 'seed-action-001' },
    update: {},
    create: {
      id: 'seed-action-001',
      rcaReportId: rca.id,
      description: 'Add a saturation alert on the Core Banking DB connection pool.',
      ownerId: responder.id,
      dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      isComplete: false,
    },
  });

  // --- SLA rollups -----------------------------------------------------------
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  await prisma.slaRecord.upsert({
    where: {
      serviceId_windowType_windowStart: {
        serviceId: coreBanking.id,
        windowType: 'MONTHLY',
        windowStart: monthStart,
      },
    },
    update: {},
    create: {
      serviceId: coreBanking.id,
      windowType: 'MONTHLY',
      windowStart: monthStart,
      windowEnd: monthEnd,
      targetPercent: '99.90',
      actualPercent: '99.98',
      errorBudgetMinutes: '43.83',
      errorBudgetConsumedMinutes: '8.80',
      breached: false,
    },
  });

  await prisma.slaRecord.upsert({
    where: {
      serviceId_windowType_windowStart: {
        serviceId: paymentsGateway.id,
        windowType: 'MONTHLY',
        windowStart: monthStart,
      },
    },
    update: {},
    create: {
      serviceId: paymentsGateway.id,
      windowType: 'MONTHLY',
      windowStart: monthStart,
      windowEnd: monthEnd,
      targetPercent: '99.90',
      actualPercent: '98.41',
      errorBudgetMinutes: '43.83',
      errorBudgetConsumedMinutes: '68.90',
      breached: true,
    },
  });

  // --- Audit trail -------------------------------------------------------------
  await prisma.auditLog.create({
    data: {
      actorId: commander.id,
      action: 'incident.acknowledge',
      entityType: 'Incident',
      entityId: ledgerIncident.id,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: commander.id,
      action: 'rca.publish',
      entityType: 'RcaReport',
      entityId: rca.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seed complete. Operator: ${adminEmail}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
