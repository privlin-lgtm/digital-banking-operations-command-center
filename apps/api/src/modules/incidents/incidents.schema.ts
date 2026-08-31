import { z } from 'zod';

const severityCodeValues = ['P1', 'P2', 'P3', 'P4'] as const;
const statusValues = ['OPEN', 'ACKNOWLEDGED', 'MITIGATED', 'RESOLVED', 'CLOSED'] as const;

export const listIncidentsQuerySchema = z.object({
  status: z.enum(statusValues).optional(),
  severity: z.enum(severityCodeValues).optional(),
  primaryServiceId: z.string().min(1).optional(),
});

export const createIncidentSchema = z.object({
  title: z.string().min(4).max(200),
  severity: z.enum(severityCodeValues),
  primaryServiceId: z.string().min(1),
  commanderId: z.string().min(1).optional(),
  alertIds: z.array(z.string().min(1)).max(50).optional(),
});

export const reclassifySeveritySchema = z.object({
  severity: z.enum(severityCodeValues),
});

export const assignCommanderSchema = z.object({
  commanderId: z.string().min(1),
});

export const resolveIncidentSchema = z.object({
  resolutionSummary: z.string().min(10).max(4000),
});

export const createCommentSchema = z.object({
  body: z.string().min(1).max(4000),
});

export type ListIncidentsQuery = z.infer<typeof listIncidentsQuerySchema>;
export type CreateIncidentBody = z.infer<typeof createIncidentSchema>;
export type ReclassifySeverityBody = z.infer<typeof reclassifySeveritySchema>;
export type AssignCommanderBody = z.infer<typeof assignCommanderSchema>;
export type ResolveIncidentBody = z.infer<typeof resolveIncidentSchema>;
export type CreateCommentBody = z.infer<typeof createCommentSchema>;
