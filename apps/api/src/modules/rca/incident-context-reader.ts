import type { PrismaClient } from '@prisma/client';

export interface IncidentContext {
  id: string;
  title: string;
  severity: string;
  status: string;
  primaryServiceName: string;
  commanderName: string | null;
  openedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

export interface TimelineEntry {
  at: Date;
  actorName: string | null;
  summary: string;
}

/**
 * A narrow, RCA-scoped read port — deliberately not a dependency on the
 * Incidents module's own repositories. RCA only ever needs a snapshot for
 * rendering a report, never the incident's mutation methods, so it reads
 * the same tables through its own adapter instead of reaching across
 * module boundaries for IncidentsRepository/IncidentTimelineRepository.
 */
export interface IncidentContextReader {
  getIncidentContext(incidentId: string): Promise<IncidentContext | null>;
  /** System timeline events and user comments, reconstructed into one chronological narrative — the "timeline reconstruction" capability. */
  reconstructTimeline(incidentId: string): Promise<TimelineEntry[]>;
  /** For rendering "Authored by <name>" / action owners in the generated report — falls back to the id itself if the user can't be found. */
  getUserName(userId: string): Promise<string | null>;
}

export class PrismaIncidentContextReader implements IncidentContextReader {
  constructor(private readonly prisma: PrismaClient) {}

  async getIncidentContext(incidentId: string): Promise<IncidentContext | null> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        primaryService: { select: { name: true } },
        commander: { select: { name: true } },
      },
    });
    if (!incident) {
      return null;
    }

    return {
      id: incident.id,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      primaryServiceName: incident.primaryService.name,
      commanderName: incident.commander?.name ?? null,
      openedAt: incident.openedAt,
      acknowledgedAt: incident.acknowledgedAt,
      resolvedAt: incident.resolvedAt,
      closedAt: incident.closedAt,
    };
  }

  async reconstructTimeline(incidentId: string): Promise<TimelineEntry[]> {
    const [events, comments] = await Promise.all([
      this.prisma.incidentTimelineEvent.findMany({
        where: { incidentId },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.incidentComment.findMany({
        where: { incidentId },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const entries: TimelineEntry[] = [
      ...events.map((event) => ({
        at: event.createdAt,
        actorName: event.actor?.name ?? null,
        summary: `[${event.type}] ${event.message}`,
      })),
      ...comments.map((comment) => ({
        at: comment.createdAt,
        actorName: comment.author.name,
        summary: `"${comment.body}"`,
      })),
    ];

    return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  async getUserName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return user?.name ?? null;
  }
}
