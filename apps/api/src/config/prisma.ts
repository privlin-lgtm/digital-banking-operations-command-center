import { PrismaClient } from '@prisma/client';
import { loadEnv } from './env.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: loadEnv().NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (loadEnv().NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
