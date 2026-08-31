import type {
  IncidentRunbook,
  Prisma,
  PrismaClient,
  Runbook,
  RunbookOutcome,
} from '@prisma/client';
import type {
  CreateRunbookInput,
  RunbooksRepository,
  SearchRunbooksFilter,
  UpdateRunbookInput,
} from './runbooks.types.js';

export class PrismaRunbooksRepository implements RunbooksRepository {
  constructor(private readonly prisma: PrismaClient) {}

  search(filter: SearchRunbooksFilter): Promise<Runbook[]> {
    const textMatch: Prisma.RunbookWhereInput[] = filter.query
      ? [
          { title: { contains: filter.query, mode: 'insensitive' } },
          { triggerCondition: { contains: filter.query, mode: 'insensitive' } },
        ]
      : [];

    return this.prisma.runbook.findMany({
      where: {
        ...(filter.category ? { category: filter.category } : {}),
        ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
        ...(textMatch.length > 0 ? { OR: textMatch } : {}),
      },
      orderBy: { title: 'asc' },
    });
  }

  findById(id: string): Promise<Runbook | null> {
    return this.prisma.runbook.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Runbook | null> {
    return this.prisma.runbook.findUnique({ where: { slug } });
  }

  create(input: CreateRunbookInput): Promise<Runbook> {
    return this.prisma.runbook.create({
      data: {
        title: input.title,
        slug: input.slug,
        category: input.category,
        triggerCondition: input.triggerCondition,
        steps: input.steps as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });
  }

  update(id: string, input: UpdateRunbookInput): Promise<Runbook> {
    return this.prisma.runbook.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.triggerCondition !== undefined
          ? { triggerCondition: input.triggerCondition }
          : {}),
        ...(input.steps !== undefined ? { steps: input.steps as Prisma.InputJsonValue } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        // Every edit is a new revision — executions recorded against this
        // runbook snapshot the version they ran (see IncidentRunbook), so
        // a later edit never silently rewrites what an incident's history
        // says actually happened.
        version: { increment: 1 },
      },
    });
  }

  linkToIncident(
    incidentId: string,
    runbookId: string,
    runbookVersion: number,
  ): Promise<IncidentRunbook> {
    return this.prisma.incidentRunbook.create({
      data: {
        incidentId,
        runbookId,
        runbookVersion,
        outcome: 'PENDING',
        executedAutomatically: false,
      },
    });
  }

  findLinkById(linkId: string): Promise<IncidentRunbook | null> {
    return this.prisma.incidentRunbook.findUnique({ where: { id: linkId } });
  }

  recordOutcome(
    linkId: string,
    outcome: RunbookOutcome,
    executedById: string | null,
    executedAutomatically: boolean,
  ): Promise<IncidentRunbook> {
    return this.prisma.incidentRunbook.update({
      where: { id: linkId },
      data: { outcome, executedById, executedAutomatically, executedAt: new Date() },
    });
  }

  findLinksForIncident(incidentId: string): Promise<IncidentRunbook[]> {
    return this.prisma.incidentRunbook.findMany({
      where: { incidentId },
      orderBy: { executedAt: 'desc' },
      include: { runbook: { select: { id: true, title: true, slug: true, category: true } } },
    });
  }
}
