import { z } from 'zod';

const categoryValues = [
  'HUMAN_ERROR',
  'CONFIGURATION_CHANGE',
  'CODE_DEFECT',
  'INFRASTRUCTURE_FAILURE',
  'THIRD_PARTY_DEPENDENCY',
  'CAPACITY_LIMIT',
  'PROCESS_GAP',
] as const;

const actionTypeValues = ['CORRECTIVE', 'PREVENTIVE'] as const;

export const createRcaReportSchema = z.object({
  rootCause: z.string().min(10).max(4000),
  rootCauseCategory: z.enum(categoryValues),
  contributingFactors: z.string().max(4000).optional(),
});

export const updateRcaReportSchema = z
  .object({
    rootCause: z.string().min(10).max(4000).optional(),
    rootCauseCategory: z.enum(categoryValues).optional(),
    contributingFactors: z.string().max(4000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const approveRcaReportSchema = z.object({
  reviewedById: z.string().min(1),
});

export const createCorrectiveActionSchema = z.object({
  type: z.enum(actionTypeValues),
  description: z.string().min(4).max(1000),
  ownerId: z.string().min(1),
  dueDate: z.coerce.date().optional(),
});

export const openActionsQuerySchema = z.object({
  ownerId: z.string().min(1).optional(),
  type: z.enum(actionTypeValues).optional(),
});

export type CreateRcaReportBody = z.infer<typeof createRcaReportSchema>;
export type UpdateRcaReportBody = z.infer<typeof updateRcaReportSchema>;
export type ApproveRcaReportBody = z.infer<typeof approveRcaReportSchema>;
export type CreateCorrectiveActionBody = z.infer<typeof createCorrectiveActionSchema>;
export type OpenActionsQuery = z.infer<typeof openActionsQuerySchema>;
