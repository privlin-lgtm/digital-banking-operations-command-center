import type { Prisma, PrismaClient } from '@prisma/client';

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * A second injected port alongside each module's repository. Business
 * logic decides *that* an action must be audited and *what* it's called
 * (`service.status_change`, `service.dependency.add`, ...) — it has no
 * idea the audit trail happens to be a Postgres table. That's what makes
 * it swappable for, say, a write-once log shipper in a later phase without
 * touching a single use case.
 */
export interface AuditLogger {
  record(entry: AuditEntry): Promise<void>;
}

export class PrismaAuditLogger implements AuditLogger {
  constructor(private readonly prisma: PrismaClient) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        ...(entry.metadata ? { metadata: entry.metadata as Prisma.InputJsonValue } : {}),
      },
    });
  }
}
