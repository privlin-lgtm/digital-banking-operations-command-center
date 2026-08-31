import { z } from 'zod';
import { REMEDIATION_ACTIONS } from './remediation.types.js';

export const executeRemediationSchema = z
  .object({
    action: z.enum(REMEDIATION_ACTIONS),
    serviceId: z.string().min(1).optional(),
    incidentId: z.string().min(1).optional(),
    autoResolveIncident: z.boolean().default(false),
  })
  .refine((data) => data.serviceId ?? data.incidentId, {
    message: 'At least one of serviceId or incidentId is required',
  });

export type ExecuteRemediationBody = z.infer<typeof executeRemediationSchema>;
