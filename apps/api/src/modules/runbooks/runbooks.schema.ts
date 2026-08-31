import { z } from 'zod';

const categoryValues = [
  'DATABASE',
  'INFRASTRUCTURE',
  'APPLICATION',
  'SECURITY',
  'MONITORING',
] as const;
const outcomeValues = ['SUCCESS', 'FAILURE', 'PARTIAL'] as const; // PENDING is a system-set initial state, never an input

const slugSchema = z
  .string()
  .min(2)
  .max(150)
  .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and hyphens only');

const stepSchema = z.object({
  order: z.number().int().min(1),
  action: z.string().min(1),
  target: z.string().min(1).optional(),
});

export const searchRunbooksQuerySchema = z.object({
  q: z.string().min(1).max(200).optional(),
  category: z.enum(categoryValues).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const createRunbookSchema = z.object({
  title: z.string().min(4).max(200),
  slug: slugSchema,
  category: z.enum(categoryValues),
  triggerCondition: z.string().min(4).max(500),
  steps: z.array(stepSchema).min(1).max(50),
});

export const updateRunbookSchema = z
  .object({
    title: z.string().min(4).max(200).optional(),
    category: z.enum(categoryValues).optional(),
    triggerCondition: z.string().min(4).max(500).optional(),
    steps: z.array(stepSchema).min(1).max(50).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const linkRunbookSchema = z.object({
  incidentId: z.string().min(1),
});

export const recordOutcomeSchema = z.object({
  outcome: z.enum(outcomeValues),
});

export type SearchRunbooksQuery = z.infer<typeof searchRunbooksQuerySchema>;
export type CreateRunbookBody = z.infer<typeof createRunbookSchema>;
export type UpdateRunbookBody = z.infer<typeof updateRunbookSchema>;
export type LinkRunbookBody = z.infer<typeof linkRunbookSchema>;
export type RecordOutcomeBody = z.infer<typeof recordOutcomeSchema>;
