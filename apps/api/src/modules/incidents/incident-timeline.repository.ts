import type { IncidentTimelineEvent, PrismaClient, Prisma } from '@prisma/client';
import type { CreateTimelineEventInput, IncidentTimelineRepository } from './incidents.types.js';

export class PrismaIncidentTimelineRepository implements IncidentTimelineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  append(input: CreateTimelineEventInput): Promise<IncidentTimelineEvent> {
    return this.prisma.incidentTimelineEvent.create({
      data: {
        incidentId: input.incidentId,
        type: input.type,
        message: input.message,
        actorId: input.actorId ?? null,
        ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
      },
    });
  }

  findByIncidentId(incidentId: string): Promise<IncidentTimelineEvent[]> {
    return this.prisma.incidentTimelineEvent.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
