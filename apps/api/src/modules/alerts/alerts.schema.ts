import { z } from 'zod';

const stateValues = ['FIRING', 'ACKNOWLEDGED', 'RESOLVED'] as const;
const severityValues = ['SEV1', 'SEV2', 'SEV3', 'SEV4'] as const;
const comparatorValues = ['GREATER_THAN', 'LESS_THAN'] as const;

export const listAlertsQuerySchema = z.object({
  serviceId: z.string().min(1).optional(),
  state: z.enum(stateValues).optional(),
  severity: z.enum(severityValues).optional(),
});

export const createAlertRuleSchema = z
  .object({
    metricName: z.string().min(1).max(120),
    comparator: z.enum(comparatorValues),
    criticalThreshold: z.number().optional(),
    highThreshold: z.number().optional(),
    mediumThreshold: z.number().optional(),
    lowThreshold: z.number().optional(),
  })
  .refine(
    (data) =>
      data.criticalThreshold !== undefined ||
      data.highThreshold !== undefined ||
      data.mediumThreshold !== undefined ||
      data.lowThreshold !== undefined,
    { message: 'At least one severity threshold must be set' },
  );

export const updateAlertRuleSchema = z
  .object({
    comparator: z.enum(comparatorValues).optional(),
    criticalThreshold: z.number().optional(),
    highThreshold: z.number().optional(),
    mediumThreshold: z.number().optional(),
    lowThreshold: z.number().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
export type CreateAlertRuleBody = z.infer<typeof createAlertRuleSchema>;
export type UpdateAlertRuleBody = z.infer<typeof updateAlertRuleSchema>;
