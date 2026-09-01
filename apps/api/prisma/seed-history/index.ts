import { PrismaClient, type UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ALERT_RULE_DEFS, RUNBOOKS, SEED, SERVICE_COMPLIANCE, SERVICES } from './config.js';
import { generateIncidents } from './incidents-gen.js';
import { generateMetricSamples } from './metrics-gen.js';
import { generateNarrative } from './narrative.js';
import { createRng } from './rng.js';
import { generateSlaRecords } from './sla-gen.js';

const prisma = new PrismaClient();

async function upsertUser(email: string, name: string, role: UserRole, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role, isActive: true },
    create: { email, name, passwordHash, role, isActive: true },
  });
}

async function wipeGeneratedData(): Promise<void> {
  await prisma.correctiveAction.deleteMany({});
  await prisma.rcaReport.deleteMany({});
  await prisma.incidentComment.deleteMany({});
  await prisma.incidentTimelineEvent.deleteMany({});
  await prisma.incidentRunbook.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.incident.deleteMany({});
  await prisma.alertRule.deleteMany({});
  await prisma.slaRecord.deleteMany({});
  await prisma.metric.deleteMany({});
  await prisma.failureSimulation.deleteMany({});
  await prisma.serviceDependency.deleteMany({});
  await prisma.runbook.deleteMany({});
  await prisma.service.deleteMany({});
}

async function chunkedCreateMany<T>(
  label: string,
  items: T[],
  create: (chunk: T[]) => Promise<unknown>,
  chunkSize = 5000,
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await create(chunk);
    // eslint-disable-next-line no-console
    console.log(`  ${label}: ${Math.min(i + chunkSize, items.length)}/${items.length}`);
  }
}

async function main(): Promise<void> {
  const now = new Date();
  const rng = createRng(SEED);

  console.log('Wiping previously generated history...');
  await wipeGeneratedData();

  console.log('Seeding users...');
  const admin = await upsertUser(
    'oscar.d@example.net',
    'Platform Admin',
    'ADMIN',
    'ChangeMe!Admin1',
  );
  await upsertUser(
    'system@bankops.internal',
    'BankOps Automation',
    'ADMIN',
    'not-a-real-password-1',
  );
  const commanders = await Promise.all([
    upsertUser('dana.commander@example.net', 'Dana Cohen', 'COMMANDER', 'ChangeMe!Commander1'),
    upsertUser('avi.commander@example.net', 'Avi Mizrahi', 'COMMANDER', 'ChangeMe!Commander1'),
    upsertUser('tamar.commander@example.net', 'Tamar Golan', 'COMMANDER', 'ChangeMe!Commander1'),
  ]);
  const responders = await Promise.all([
    upsertUser('yossi.responder@example.net', 'Yossi Levi', 'RESPONDER', 'ChangeMe!Responder1'),
    upsertUser('maya.responder@example.net', 'Maya Peretz', 'RESPONDER', 'ChangeMe!Responder1'),
    upsertUser('eitan.responder@example.net', 'Eitan Shapiro', 'RESPONDER', 'ChangeMe!Responder1'),
    upsertUser('lior.responder@example.net', 'Lior Ben-David', 'RESPONDER', 'ChangeMe!Responder1'),
    upsertUser('roni.responder@example.net', 'Roni Azulay', 'RESPONDER', 'ChangeMe!Responder1'),
    upsertUser('daniel.responder@example.net', 'Daniel Katz', 'RESPONDER', 'ChangeMe!Responder1'),
  ]);
  await upsertUser('noa.viewer@example.net', 'Noa Bar', 'VIEWER', 'ChangeMe!Viewer1');

  console.log('Creating service catalog...');
  const serviceIdByKey = new Map<string, string>();
  for (const def of SERVICES) {
    const compliance = SERVICE_COMPLIANCE[def.key];
    const service = await prisma.service.create({
      data: {
        name: def.name,
        slug: def.slug,
        tier: def.tier,
        ownerTeam: def.ownerTeam,
        status: 'HEALTHY',
        complianceScope: compliance?.complianceScope ?? [],
        dataClassification: compliance?.dataClassification ?? 'INTERNAL',
      },
    });
    serviceIdByKey.set(def.key, service.id);
  }
  for (const def of SERVICES) {
    for (const dep of def.dependsOn) {
      await prisma.serviceDependency.create({
        data: {
          serviceId: serviceIdByKey.get(def.key)!,
          dependsOnServiceId: serviceIdByKey.get(dep.key)!,
          dependencyType: dep.type,
        },
      });
    }
  }

  console.log('Creating runbook library...');
  const runbookByKey = new Map<string, { id: string; version: number; title: string }>();
  for (const def of RUNBOOKS) {
    const runbook = await prisma.runbook.create({
      data: {
        title: def.title,
        slug: def.slug,
        category: def.category,
        triggerCondition: def.triggerCondition,
        steps: def.steps,
        version: 1,
        isActive: true,
        createdById: admin.id,
      },
    });
    runbookByKey.set(def.slug, { id: runbook.id, version: runbook.version, title: runbook.title });
  }

  console.log('Creating alert rules...');
  for (const def of ALERT_RULE_DEFS) {
    const serviceId = serviceIdByKey.get(def.serviceKey);
    if (!serviceId) continue;
    await prisma.alertRule.create({
      data: {
        serviceId,
        metricName: def.metricName,
        comparator: def.comparator,
        criticalThreshold: def.criticalThreshold ?? null,
        highThreshold: def.highThreshold ?? null,
        mediumThreshold: def.mediumThreshold ?? null,
        lowThreshold: def.lowThreshold ?? null,
        isActive: true,
        createdById: admin.id,
      },
    });
  }

  console.log('Generating six-month narrative...');
  const beats = generateNarrative(rng, now);
  console.log(
    `  ${beats.filter((b) => b.kind === 'INCIDENT').length} incidents, ${beats.filter((b) => b.kind === 'DEGRADED').length} degraded periods`,
  );

  console.log(
    'Generating infrastructure + synthetic-transaction metrics (this can take a moment)...',
  );
  const metricSamples = generateMetricSamples(rng, beats, now);
  console.log(`  ${metricSamples.length} metric samples`);
  await chunkedCreateMany('metrics inserted', metricSamples, (chunk) =>
    prisma.metric.createMany({
      data: chunk.map((s) => ({
        serviceId: serviceIdByKey.get(s.serviceKey)!,
        metricName: s.metricName,
        value: s.value,
        unit: s.unit,
        recordedAt: s.recordedAt,
      })),
      skipDuplicates: true,
    }),
  );

  console.log('Generating incidents, alerts, timelines, runbook runs, and RCA reports...');
  const { summaries, incidentCount, alertCount, rcaCount } = await generateIncidents(
    prisma,
    rng,
    beats,
    {
      serviceIdByKey,
      runbookByKey,
      admin,
      commanders,
      responders,
      now,
    },
  );
  console.log(`  ${incidentCount} incidents, ${alertCount} alerts, ${rcaCount} RCA reports`);

  console.log('Computing SLA rollups (daily/weekly/monthly) via the real SlaCalculator...');
  const slaRecords = generateSlaRecords(beats, metricSamples, summaries, now);
  console.log(`  ${slaRecords.length} SLA records`);
  await chunkedCreateMany('SLA records inserted', slaRecords, (chunk) =>
    prisma.slaRecord.createMany({
      data: chunk.map((r) => ({
        serviceId: serviceIdByKey.get(r.serviceKey)!,
        windowType: r.windowType,
        windowStart: r.windowStart,
        windowEnd: r.windowEnd,
        targetPercent: r.targetPercent.toFixed(2),
        actualPercent: r.actualPercent.toFixed(2),
        errorBudgetMinutes: r.errorBudgetMinutes.toFixed(2),
        errorBudgetConsumedMinutes: r.errorBudgetConsumedMinutes.toFixed(2),
        avgResponseTimeMs: r.avgResponseTimeMs?.toFixed(2) ?? null,
        meanTimeToDetectMinutes: r.meanTimeToDetectMinutes?.toFixed(2) ?? null,
        meanTimeToRecoverMinutes: r.meanTimeToRecoverMinutes?.toFixed(2) ?? null,
        breached: r.breached,
      })),
    }),
  );

  const severityCounts = summaries.reduce<Record<string, number>>((acc, s) => {
    acc[s.severity] = (acc[s.severity] ?? 0) + 1;
    return acc;
  }, {});

  console.log('\nDone. Six-month history summary:');
  console.log(`  Services: ${SERVICES.length}`);
  console.log(`  Runbooks: ${RUNBOOKS.length}`);
  console.log(`  Alert rules: ${ALERT_RULE_DEFS.length}`);
  console.log(`  Metric samples: ${metricSamples.length}`);
  console.log(`  Incidents: ${incidentCount} (${JSON.stringify(severityCounts)})`);
  console.log(`  Alerts: ${alertCount}`);
  console.log(`  RCA reports: ${rcaCount}`);
  console.log(`  SLA records: ${slaRecords.length}`);
  console.log(`  Operator login: ${admin.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
