import { z } from 'zod';

const tierValues = ['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'] as const;
const statusValues = ['HEALTHY', 'DEGRADED', 'CRITICAL', 'MAINTENANCE', 'UNKNOWN'] as const;

const slugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and hyphens only');

export const listServicesQuerySchema = z.object({
  tier: z.enum(tierValues).optional(),
  status: z.enum(statusValues).optional(),
});

export const createServiceSchema = z.object({
  name: z.string().min(2).max(120),
  slug: slugSchema,
  tier: z.enum(tierValues),
  ownerTeam: z.string().min(2).max(120),
});

export const updateServiceSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    slug: slugSchema.optional(),
    tier: z.enum(tierValues).optional(),
    ownerTeam: z.string().min(2).max(120).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateServiceStatusSchema = z.object({
  status: z.enum(statusValues),
});

export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;
export type CreateServiceBody = z.infer<typeof createServiceSchema>;
export type UpdateServiceBody = z.infer<typeof updateServiceSchema>;
export type UpdateServiceStatusBody = z.infer<typeof updateServiceStatusSchema>;
