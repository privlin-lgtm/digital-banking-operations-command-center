import { z } from 'zod';

/**
 * Closes the "no filtering or pagination" gap the earlier security review
 * left documented-not-fixed: a real investigative workflow against months
 * of audit history needs cursor pagination plus filters by actor, entity,
 * and action — not a hardcoded take: 100.
 */
export const listAuditLogsQuerySchema = z.object({
  // AuditLog.id is a BigInt (append-only, high-volume table) serialized as
  // a string at the HTTP boundary — the cursor is the same string back.
  cursor: z.string().regex(/^\d+$/, 'cursor must be a numeric id').optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  actorId: z.string().min(1).optional(),
  entityType: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
