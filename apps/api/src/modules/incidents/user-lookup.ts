import type { PrismaClient } from '@prisma/client';

/** Another narrow, single-purpose port — see IncidentRcaGate for why this isn't a full UsersRepository. */
export interface UserLookup {
  isActiveUser(userId: string): Promise<boolean>;
}

export class PrismaUserLookup implements UserLookup {
  constructor(private readonly prisma: PrismaClient) {}

  async isActiveUser(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    return user?.isActive === true;
  }
}
