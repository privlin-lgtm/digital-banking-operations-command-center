import type { DemoModeState, PrismaClient } from '@prisma/client';
import type { DemoModeRepository, ReviewerLookup } from './demo-mode.types.js';

const SINGLETON_ID = 'singleton';

export class PrismaDemoModeRepository implements DemoModeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(): Promise<DemoModeState> {
    return this.prisma.demoModeState.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
  }

  async update(patch: Partial<DemoModeState>): Promise<DemoModeState> {
    return this.prisma.demoModeState.update({
      where: { id: SINGLETON_ID },
      data: patch,
    });
  }
}

/** Picks any active COMMANDER/ADMIN other than the author to satisfy RcaService.approve's four-eyes rule. */
export class PrismaReviewerLookup implements ReviewerLookup {
  constructor(private readonly prisma: PrismaClient) {}

  async findReviewerCandidate(excludeUserId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: {
        isActive: true,
        id: { not: excludeUserId },
        role: { in: ['COMMANDER', 'ADMIN'] },
      },
      select: { id: true },
    });
  }
}
