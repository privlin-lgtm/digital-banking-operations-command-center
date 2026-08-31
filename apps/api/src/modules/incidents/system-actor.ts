import type { UserRole } from '@bankops/shared';
import type { PrismaClient } from '@prisma/client';

/**
 * Resolves the reserved service-account user (see prisma/seed.ts) used as
 * `actorId` on AuditLog rows a scheduled job writes when nothing triggered
 * it but the clock — the escalation sweep, the SLA rollup, and the failure
 * simulator's tick loop all share this one lookup. Cached after the first
 * successful lookup — this is a fixed row, not something that changes at
 * runtime.
 */
let cached: { id: string; role: UserRole } | undefined;

export async function resolveSystemActor(
  prisma: PrismaClient,
  email: string,
): Promise<{ id: string; role: UserRole } | null> {
  if (cached) {
    return cached;
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!user) {
    return null;
  }
  cached = user;
  return cached;
}

export async function resolveSystemActorId(
  prisma: PrismaClient,
  email: string,
): Promise<string | null> {
  const actor = await resolveSystemActor(prisma, email);
  return actor?.id ?? null;
}
