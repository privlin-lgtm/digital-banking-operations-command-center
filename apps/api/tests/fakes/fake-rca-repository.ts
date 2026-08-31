import type { CorrectiveAction, CorrectiveActionType, RcaReport, RcaStatus } from '@prisma/client';
import type {
  CreateCorrectiveActionInput,
  CreateRcaReportInput,
  RcaReportsRepository,
  UpdateRcaReportInput,
} from '../../src/modules/rca/rca.types.js';
import type {
  IncidentContext,
  IncidentContextReader,
  TimelineEntry,
} from '../../src/modules/rca/incident-context-reader.js';
import type { IncidentLookup } from '../../src/modules/rca/incident-lookup.js';

let idCounter = 0;

export function makeRcaReport(overrides: Partial<RcaReport> = {}): RcaReport {
  idCounter += 1;
  const now = new Date();
  return {
    id: overrides.id ?? `rca-${idCounter}`,
    incidentId: overrides.incidentId ?? `inc-${idCounter}`,
    rootCause:
      overrides.rootCause ?? 'Connection pool exhaustion after a deploy shrank max pool size.',
    rootCauseCategory: overrides.rootCauseCategory ?? 'CONFIGURATION_CHANGE',
    contributingFactors: overrides.contributingFactors ?? null,
    authoredById: overrides.authoredById ?? 'author-1',
    reviewedById: overrides.reviewedById ?? null,
    status: overrides.status ?? 'DRAFT',
    publishedAt: overrides.publishedAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export class FakeRcaReportsRepository implements RcaReportsRepository {
  private readonly rows = new Map<string, RcaReport>();
  private readonly actions = new Map<string, CorrectiveAction>();
  private actionCounter = 0;

  seed(report: RcaReport): RcaReport {
    this.rows.set(report.id, report);
    return report;
  }

  async findById(id: string): Promise<RcaReport | null> {
    return this.rows.get(id) ?? null;
  }

  async findByIncidentId(incidentId: string): Promise<RcaReport | null> {
    return [...this.rows.values()].find((row) => row.incidentId === incidentId) ?? null;
  }

  async create(input: CreateRcaReportInput): Promise<RcaReport> {
    const report = makeRcaReport({
      ...input,
      contributingFactors: input.contributingFactors ?? null,
    });
    this.rows.set(report.id, report);
    return report;
  }

  async update(id: string, input: UpdateRcaReportInput): Promise<RcaReport> {
    const existing = this.mustGet(id);
    const updated: RcaReport = {
      ...existing,
      ...(input.rootCause !== undefined ? { rootCause: input.rootCause } : {}),
      ...(input.rootCauseCategory !== undefined
        ? { rootCauseCategory: input.rootCauseCategory }
        : {}),
      ...(input.contributingFactors !== undefined
        ? { contributingFactors: input.contributingFactors }
        : {}),
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async transitionStatus(
    id: string,
    status: RcaStatus,
    fields: { reviewedById?: string; publishedAt?: Date },
  ): Promise<RcaReport> {
    const existing = this.mustGet(id);
    const updated: RcaReport = {
      ...existing,
      status,
      ...(fields.reviewedById ? { reviewedById: fields.reviewedById } : {}),
      ...(fields.publishedAt ? { publishedAt: fields.publishedAt } : {}),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async addCorrectiveAction(input: CreateCorrectiveActionInput): Promise<CorrectiveAction> {
    this.actionCounter += 1;
    const action: CorrectiveAction = {
      id: `action-${this.actionCounter}`,
      rcaReportId: input.rcaReportId,
      type: input.type,
      description: input.description,
      ownerId: input.ownerId,
      dueDate: input.dueDate ?? null,
      isComplete: false,
      createdAt: new Date(),
    };
    this.actions.set(action.id, action);
    return action;
  }

  async findCorrectiveAction(id: string): Promise<CorrectiveAction | null> {
    return this.actions.get(id) ?? null;
  }

  async markCorrectiveActionComplete(id: string): Promise<CorrectiveAction> {
    const existing = this.actions.get(id);
    if (!existing) {
      throw new Error(`FakeRcaReportsRepository: action "${id}" not found`);
    }
    const updated = { ...existing, isComplete: true };
    this.actions.set(id, updated);
    return updated;
  }

  async findCorrectiveActionsByReportId(rcaReportId: string): Promise<CorrectiveAction[]> {
    return [...this.actions.values()].filter((action) => action.rcaReportId === rcaReportId);
  }

  async findOpenActions(filter: {
    ownerId?: string;
    type?: CorrectiveActionType;
  }): Promise<CorrectiveAction[]> {
    return [...this.actions.values()].filter(
      (action) =>
        !action.isComplete &&
        (!filter.ownerId || action.ownerId === filter.ownerId) &&
        (!filter.type || action.type === filter.type),
    );
  }

  private mustGet(id: string): RcaReport {
    const existing = this.rows.get(id);
    if (!existing) {
      throw new Error(`FakeRcaReportsRepository: "${id}" not found`);
    }
    return existing;
  }
}

export class FakeIncidentLookup implements IncidentLookup {
  existingIncidentIds = new Set<string>();

  async exists(incidentId: string): Promise<boolean> {
    return this.existingIncidentIds.has(incidentId);
  }
}

export class FakeIncidentContextReader implements IncidentContextReader {
  contexts = new Map<string, IncidentContext>();
  timelines = new Map<string, TimelineEntry[]>();
  userNames = new Map<string, string>();

  async getIncidentContext(incidentId: string): Promise<IncidentContext | null> {
    return this.contexts.get(incidentId) ?? null;
  }

  async reconstructTimeline(incidentId: string): Promise<TimelineEntry[]> {
    return this.timelines.get(incidentId) ?? [];
  }

  async getUserName(userId: string): Promise<string | null> {
    return this.userNames.get(userId) ?? null;
  }
}
