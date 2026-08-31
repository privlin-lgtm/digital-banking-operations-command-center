import type { AlertRule, PrismaClient } from '@prisma/client';
import type {
  AlertRulesRepository,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
} from './alerts.types.js';

export class PrismaAlertRulesRepository implements AlertRulesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByServiceAndMetric(serviceId: string, metricName: string): Promise<AlertRule | null> {
    return this.prisma.alertRule.findUnique({
      where: { serviceId_metricName: { serviceId, metricName } },
    });
  }

  findById(id: string): Promise<AlertRule | null> {
    return this.prisma.alertRule.findUnique({ where: { id } });
  }

  findByServiceId(serviceId: string): Promise<AlertRule[]> {
    return this.prisma.alertRule.findMany({ where: { serviceId }, orderBy: { metricName: 'asc' } });
  }

  create(input: CreateAlertRuleInput): Promise<AlertRule> {
    return this.prisma.alertRule.create({
      data: {
        serviceId: input.serviceId,
        metricName: input.metricName,
        comparator: input.comparator,
        createdById: input.createdById,
        ...(input.criticalThreshold !== undefined
          ? { criticalThreshold: input.criticalThreshold }
          : {}),
        ...(input.highThreshold !== undefined ? { highThreshold: input.highThreshold } : {}),
        ...(input.mediumThreshold !== undefined ? { mediumThreshold: input.mediumThreshold } : {}),
        ...(input.lowThreshold !== undefined ? { lowThreshold: input.lowThreshold } : {}),
      },
    });
  }

  update(id: string, input: UpdateAlertRuleInput): Promise<AlertRule> {
    return this.prisma.alertRule.update({
      where: { id },
      data: {
        ...(input.comparator !== undefined ? { comparator: input.comparator } : {}),
        ...(input.criticalThreshold !== undefined
          ? { criticalThreshold: input.criticalThreshold }
          : {}),
        ...(input.highThreshold !== undefined ? { highThreshold: input.highThreshold } : {}),
        ...(input.mediumThreshold !== undefined ? { mediumThreshold: input.mediumThreshold } : {}),
        ...(input.lowThreshold !== undefined ? { lowThreshold: input.lowThreshold } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }
}
