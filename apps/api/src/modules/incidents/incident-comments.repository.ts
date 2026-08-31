import type { IncidentComment, PrismaClient } from '@prisma/client';
import type { CreateCommentInput, IncidentCommentsRepository } from './incidents.types.js';

export class PrismaIncidentCommentsRepository implements IncidentCommentsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateCommentInput): Promise<IncidentComment> {
    return this.prisma.incidentComment.create({
      data: { incidentId: input.incidentId, authorId: input.authorId, body: input.body },
    });
  }

  findByIncidentId(incidentId: string): Promise<IncidentComment[]> {
    return this.prisma.incidentComment.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
