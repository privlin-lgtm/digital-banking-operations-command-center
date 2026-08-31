import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'oscar.d@example.net';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Admin1';
  const name = process.env.SEED_ADMIN_NAME ?? 'Platform Admin';

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: UserRole.ADMIN, isActive: true },
    create: {
      email,
      name,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const customer = await prisma.customer.upsert({
    where: { externalId: 'CUST-0001' },
    update: {},
    create: {
      externalId: 'CUST-0001',
      fullName: 'Avery Chen',
      email: 'avery.chen@example.com',
      kycStatus: 'VERIFIED',
      accounts: {
        create: {
          iban: 'US00BANKOPS0000000001',
          currency: 'USD',
          status: 'ACTIVE',
        },
      },
    },
    include: { accounts: true },
  });

  const accountId = customer.accounts[0]?.id ?? null;

  await prisma.transaction.upsert({
    where: { reference: 'TXN-SEED-001' },
    update: {},
    create: {
      reference: 'TXN-SEED-001',
      customerId: customer.id,
      accountId,
      amount: '12500.00',
      currency: 'USD',
      status: 'FLAGGED',
      description: 'High-value outbound wire',
      occurredAt: new Date(),
    },
  });

  const flagged = await prisma.transaction.findUniqueOrThrow({
    where: { reference: 'TXN-SEED-001' },
  });

  await prisma.alert.upsert({
    where: { id: 'seed-alert-001' },
    update: {},
    create: {
      id: 'seed-alert-001',
      title: 'High-value wire exceeds policy threshold',
      description: 'Outbound transfer of USD 12,500 flagged for review.',
      severity: 'HIGH',
      status: 'OPEN',
      source: 'transaction-monitor',
      transactionId: flagged.id,
      assignedToId: admin.id,
    },
  });

  await prisma.case.upsert({
    where: { id: 'seed-case-001' },
    update: {},
    create: {
      id: 'seed-case-001',
      title: 'Review flagged wire — Avery Chen',
      description: 'Initial investigation case for seed transaction TXN-SEED-001.',
      status: 'OPEN',
      customerId: customer.id,
      assignedToId: admin.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seed complete. Operator: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
