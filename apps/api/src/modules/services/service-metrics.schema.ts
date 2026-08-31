import { z } from 'zod';

export const recordMetricSchema = z.object({
  metricName: z.string().min(1).max(120),
  value: z.number().finite(),
  unit: z.string().min(1).max(32),
  recordedAt: z.coerce.date().optional(),
});

export const listMetricsQuerySchema = z.object({
  metricName: z.string().min(1).optional(),
  since: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type RecordMetricBody = z.infer<typeof recordMetricSchema>;
export type ListMetricsQuery = z.infer<typeof listMetricsQuerySchema>;
