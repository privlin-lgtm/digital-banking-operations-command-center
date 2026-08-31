import type {
  CorrectiveAction,
  CorrectiveActionType,
  PrismaClient,
  RcaReport,
  RcaStatus,
} from '@prisma/client';
import type {
  CreateCorrectiveActionInput,
  CreateRcaReportInput,
  RcaReportsRepository,
  UpdateRcaReportInput,
} from './rca.types.js';

export class PrismaRcaReportsRepository implements RcaReportsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<RcaReport | null> {
    return this.prisma.rcaReport.findUnique({ where: { id } });
  }

  findByIncidentId(incidentId: string): Promise<RcaReport | null> {
    return this.prisma.rcaReport.findUnique({ where: { incidentId } });
  }

  create(input: CreateRcaReportInput): Promise<RcaReport> {
    return this.prisma.rcaReport.create({
      data: {
        incidentId: input.incidentId,
        rootCause: input.rootCause,
        rootCauseCategory: input.rootCauseCategory,
        authoredById: input.authoredById,
        ...(input.contributingFactors !== undefined
          ? { contributingFactors: input.contributingFactors }
          : {}),
      },
    });
  }

  update(id: string, input: UpdateRcaReportInput): Promise<RcaReport> {
    return this.prisma.rcaReport.update({
      where: { id },
      data: {
        ...(input.rootCause !== undefined ? { rootCause: input.rootCause } : {}),
        ...(input.rootCauseCategory !== undefined
          ? { rootCauseCategory: input.rootCauseCategory }
          : {}),
        ...(input.contributingFactors !== undefined
          ? { contributingFactors: input.contributingFactors }
          : {}),
      },
    });
  }

  transitionStatus(
    id: string,
    status: RcaStatus,
    fields: { reviewedById?: string; publishedAt?: Date },
  ): Promise<RcaReport> {
    return this.prisma.rcaReport.update({
      where: { id },
      data: {
        status,
        ...(fields.reviewedById ? { reviewedById: fields.reviewedById } : {}),
        ...(fields.publishedAt ? { publishedAt: fields.publishedAt } : {}),
      },
    });
  }

  addCorrectiveAction(input: CreateCorrectiveActionInput): Promise<CorrectiveAction> {
    return this.prisma.correctiveAction.create({
      data: {
        rcaReportId: input.rcaReportId,
        type: input.type,
        description: input.description,
        ownerId: input.ownerId,
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      },
    });
  }

  findCorrectiveAction(id: string): Promise<CorrectiveAction | null> {
    return this.prisma.correctiveAction.findUnique({ where: { id } });
  }

  markCorrectiveActionComplete(id: string): Promise<CorrectiveAction> {
    return this.prisma.correctiveAction.update({ where: { id }, data: { isComplete: true } });
  }

  findCorrectiveActionsByReportId(rcaReportId: string): Promise<CorrectiveAction[]> {
    return this.prisma.correctiveAction.findMany({
      where: { rcaReportId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findOpenActions(filter: {
    ownerId?: string;
    type?: CorrectiveActionType;
  }): Promise<CorrectiveAction[]> {
    return this.prisma.correctiveAction.findMany({
      where: {
        isComplete: false,
        ...(filter.ownerId ? { ownerId: filter.ownerId } : {}),
        ...(filter.type ? { type: filter.type } : {}),
      },
      include: { rcaReport: { select: { id: true, incidentId: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
