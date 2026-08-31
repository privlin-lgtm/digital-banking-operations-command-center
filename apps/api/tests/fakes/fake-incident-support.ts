import type { IncidentComment, IncidentTimelineEvent, Prisma } from '@prisma/client';
import type {
  CreateCommentInput,
  CreateTimelineEventInput,
  IncidentCommentsRepository,
  IncidentTimelineRepository,
} from '../../src/modules/incidents/incidents.types.js';
import type { IncidentRcaGate } from '../../src/modules/incidents/incident-rca-gate.js';
import type { UserLookup } from '../../src/modules/incidents/user-lookup.js';

let idCounter = 0;

export class FakeIncidentTimelineRepository implements IncidentTimelineRepository {
  readonly events: IncidentTimelineEvent[] = [];

  async append(input: CreateTimelineEventInput): Promise<IncidentTimelineEvent> {
    idCounter += 1;
    const event: IncidentTimelineEvent = {
      id: `evt-${idCounter}`,
      incidentId: input.incidentId,
      type: input.type,
      message: input.message,
      actorId: input.actorId ?? null,
      metadata: (input.metadata as Prisma.JsonValue | undefined) ?? null,
      createdAt: new Date(),
    };
    this.events.push(event);
    return event;
  }

  async findByIncidentId(incidentId: string): Promise<IncidentTimelineEvent[]> {
    return this.events.filter((event) => event.incidentId === incidentId);
  }
}

export class FakeIncidentCommentsRepository implements IncidentCommentsRepository {
  readonly comments: IncidentComment[] = [];

  async create(input: CreateCommentInput): Promise<IncidentComment> {
    idCounter += 1;
    const now = new Date();
    const comment: IncidentComment = {
      id: `cmt-${idCounter}`,
      incidentId: input.incidentId,
      authorId: input.authorId,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    };
    this.comments.push(comment);
    return comment;
  }

  async findByIncidentId(incidentId: string): Promise<IncidentComment[]> {
    return this.comments.filter((comment) => comment.incidentId === incidentId);
  }
}

export class FakeIncidentRcaGate implements IncidentRcaGate {
  approvedIncidentIds = new Set<string>();

  async hasApprovedRca(incidentId: string): Promise<boolean> {
    return this.approvedIncidentIds.has(incidentId);
  }
}

export class FakeUserLookup implements UserLookup {
  activeUserIds = new Set<string>();

  async isActiveUser(userId: string): Promise<boolean> {
    return this.activeUserIds.has(userId);
  }
}
