import type { Alert, PrismaClient } from '@prisma/client';
import type { AlertsRepository, FireOrUpdateAlertInput, ListAlertsFilter } from './alerts.types.js';

export class PrismaAlertsRepository implements AlertsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findMany(filter: ListAlertsFilter): Promise<Alert[]> {
    return this.prisma.alert.findMany({
      where: {
        ...(filter.serviceId ? { serviceId: filter.serviceId } : {}),
        ...(filter.state ? { state: filter.state } : {}),
        ...(filter.severity ? { severity: filter.severity } : {}),
      },
      orderBy: { firedAt: 'desc' },
      take: 200,
    });
  }

  findById(id: string): Promise<Alert | null> {
    return this.prisma.alert.findUnique({ where: { id } });
  }

  findFiring(serviceId: string, ruleName: string): Promise<Alert | null> {
    return this.prisma.alert.findFirst({ where: { serviceId, ruleName, state: 'FIRING' } });
  }

  /**
   * Re-firing the same rule (severity escalated or de-escalated while
   * still breaching) updates the existing FIRING row in place rather than
   * creating a second one — the partial unique index on (serviceId,
   * ruleName) WHERE state = 'FIRING' would reject a second insert anyway,
   * but doing the find-first here means a re-fire is a normal update, not
   * a caught constraint violation.
   */
  async fireOrUpdate(input: FireOrUpdateAlertInput): Promise<Alert> {
    const existing = await this.findFiring(input.serviceId, input.ruleName);
    if (existing) {
      if (existing.severity === input.severity) {
        return existing;
      }
      return this.prisma.alert.update({
        where: { id: existing.id },
        data: { severity: input.severity },
      });
    }

    return this.prisma.alert.create({
      data: {
        serviceId: input.serviceId,
        ruleName: input.ruleName,
        severity: input.severity,
        fingerprint: input.fingerprint,
        state: 'FIRING',
      },
    });
  }

  acknowledge(id: string): Promise<Alert> {
    return this.prisma.alert.update({ where: { id }, data: { state: 'ACKNOWLEDGED' } });
  }

  resolve(id: string): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id },
      data: { state: 'RESOLVED', resolvedAt: new Date() },
    });
  }

  linkToIncident(id: string, incidentId: string): Promise<Alert> {
    return this.prisma.alert.update({ where: { id }, data: { incidentId } });
  }
}
