import { z } from 'zod';

const windowTypeValues = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;

export const windowTypeQuerySchema = z.object({
  windowType: z.enum(windowTypeValues).default('MONTHLY'),
});

export const historyQuerySchema = z.object({
  windowType: z.enum(windowTypeValues).default('MONTHLY'),
  limit: z.coerce.number().int().min(1).max(60).default(12),
});

export const calculateSlaSchema = z.object({
  windowType: z.enum(windowTypeValues),
  windowStart: z.coerce.date(),
  windowEnd: z.coerce.date(),
  targetPercent: z.coerce.number().min(0).max(100).default(99.9),
});

export type WindowTypeQuery = z.infer<typeof windowTypeQuerySchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type CalculateSlaBody = z.infer<typeof calculateSlaSchema>;
