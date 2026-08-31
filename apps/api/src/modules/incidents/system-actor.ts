import type { PrismaClient } from '@prisma/client';

/**
 * Resolves the reserved service-account user (see prisma/seed.ts) used as
 * `actorId` on AuditLog rows the escalation sweep writes when nothing
 * triggered it but the clock. Cached after the first successful lookup —
 * this is a fixed row, not something that changes at runtime.
 */
let cachedId: string | undefined;

export async function resolveSystemActorId(
  prisma: PrismaClient,
  email: string,
): Promise<string | null> {
  if (cachedId) {
    return cachedId;
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    return null;
  }
  cachedId = user.id;
  return cachedId;
}
