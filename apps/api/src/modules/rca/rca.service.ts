import type { CorrectiveActionType } from '@prisma/client';
import type { Logger } from 'pino';
import type { AuditLogger } from '../audit/audit-logger.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { IncidentContextReader } from './incident-context-reader.js';
import type { IncidentLookup } from './incident-lookup.js';
import type { RcaReportGenerator } from './rca-report-generator.js';
import type {
  CreateCorrectiveActionInput,
  CreateRcaReportInput,
  RcaReportsRepository,
  UpdateRcaReportInput,
} from './rca.types.js';

export class RcaService {
  constructor(
    private readonly repository: RcaReportsRepository,
    private readonly incidentLookup: IncidentLookup,
    private readonly contextReader: IncidentContextReader,
    private readonly reportGenerator: RcaReportGenerator,
    private readonly auditLogger: AuditLogger,
    private readonly logger: Logger,
  ) {}

  async getById(id: string) {
    const report = await this.repository.findById(id);
    if (!report) {
      throw new NotFoundError(`RCA report "${id}" not found`);
    }
    return report;
  }

  async getByIncidentId(incidentId: string) {
    const report = await this.repository.findByIncidentId(incidentId);
    if (!report) {
      throw new NotFoundError(`No RCA report exists for incident "${incidentId}"`);
    }
    return report;
  }

  async create(input: CreateRcaReportInput) {
    const incidentExists = await this.incidentLookup.exists(input.incidentId);
    if (!incidentExists) {
      throw new NotFoundError(`Incident "${input.incidentId}" not found`);
    }

    const existing = await this.repository.findByIncidentId(input.incidentId);
    if (existing) {
      throw new ConflictError(`Incident "${input.incidentId}" already has an RCA report`);
    }

    const report = await this.repository.create(input);
    this.logger.info(
      { rcaReportId: report.id, incidentId: input.incidentId },
      'RCA report drafted',
    );
    await this.auditLogger.record({
      actorId: input.authoredById,
      action: 'rca.create',
      entityType: 'Incident',
      entityId: input.incidentId,
      metadata: { rcaReportId: report.id, category: report.rootCauseCategory },
    });
    return report;
  }

  async update(id: string, input: UpdateRcaReportInput, actorId: string) {
    const report = await this.getById(id);
    if (report.status === 'APPROVED') {
      throw new ValidationError('Cannot edit an already-approved RCA report');
    }

    const updated = await this.repository.update(id, input);
    await this.auditLogger.record({
      actorId,
      action: 'rca.update',
      entityType: 'Incident',
      entityId: report.incidentId,
    });
    return updated;
  }

  async submitForReview(id: string, actorId: string) {
    const report = await this.getById(id);
    if (report.status !== 'DRAFT') {
      throw new ValidationError(`Cannot submit an RCA report that is already ${report.status}`);
    }

    const updated = await this.repository.transitionStatus(id, 'IN_REVIEW', {});
    await this.auditLogger.record({
      actorId,
      action: 'rca.submit',
      entityType: 'Incident',
      entityId: report.incidentId,
    });
    return updated;
  }

  /** Four-eyes principle: the reviewer can never be the author, matching the model's original design intent. */
  async approve(id: string, reviewedById: string, actorId: string) {
    const report = await this.getById(id);
    if (report.status !== 'IN_REVIEW') {
      throw new ValidationError(
        `Cannot approve an RCA report that is ${report.status}, not IN_REVIEW`,
      );
    }
    if (reviewedById === report.authoredById) {
      throw new ValidationError('An RCA report cannot be reviewed by its own author');
    }

    const updated = await this.repository.transitionStatus(id, 'APPROVED', {
      reviewedById,
      publishedAt: new Date(),
    });
    this.logger.info({ rcaReportId: id, reviewedById }, 'RCA report approved');
    await this.auditLogger.record({
      actorId,
      action: 'rca.approve',
      entityType: 'Incident',
      entityId: report.incidentId,
      metadata: { reviewedById },
    });
    return updated;
  }

  async addCorrectiveAction(input: CreateCorrectiveActionInput, actorId: string) {
    await this.getById(input.rcaReportId);
    const action = await this.repository.addCorrectiveAction(input);
    await this.auditLogger.record({
      actorId,
      action: 'rca.action.add',
      entityType: 'RcaReport',
      entityId: input.rcaReportId,
      metadata: { type: input.type },
    });
    return action;
  }

  async markActionComplete(actionId: string, actorId: string) {
    const action = await this.repository.findCorrectiveAction(actionId);
    if (!action) {
      throw new NotFoundError(`Corrective action "${actionId}" not found`);
    }
    const updated = await this.repository.markCorrectiveActionComplete(actionId);
    await this.auditLogger.record({
      actorId,
      action: 'rca.action.complete',
      entityType: 'RcaReport',
      entityId: action.rcaReportId,
    });
    return updated;
  }

  getCorrectiveActions(rcaReportId: string) {
    return this.repository.findCorrectiveActionsByReportId(rcaReportId);
  }

  getOpenActions(filter: {
    ownerId?: string | undefined;
    type?: CorrectiveActionType | undefined;
  }) {
    return this.repository.findOpenActions(filter);
  }

  /**
   * "Report generation service": assembles the incident's context,
   * reconstructed timeline, RCA fields, and corrective/preventive
   * actions into the Markdown document a stakeholder actually reads.
   * The gathering happens here; the formatting is delegated to
   * RcaReportGenerator, which knows nothing about Prisma.
   */
  async generateReport(incidentId: string): Promise<{ markdown: string }> {
    const [report, incident, timeline] = await Promise.all([
      this.getByIncidentId(incidentId),
      this.contextReader.getIncidentContext(incidentId),
      this.contextReader.reconstructTimeline(incidentId),
    ]);

    if (!incident) {
      throw new NotFoundError(`Incident "${incidentId}" not found`);
    }

    const actions = await this.repository.findCorrectiveActionsByReportId(report.id);
    const actionsWithOwnerNames = await Promise.all(
      actions.map(async (action) => ({
        type: action.type,
        description: action.description,
        ownerName: await this.resolveOwnerName(action.ownerId),
        dueDate: action.dueDate,
        isComplete: action.isComplete,
      })),
    );

    const [authoredByName, reviewedByName] = await Promise.all([
      this.resolveOwnerName(report.authoredById),
      report.reviewedById ? this.resolveOwnerName(report.reviewedById) : Promise.resolve(null),
    ]);

    const markdown = this.reportGenerator.generateMarkdown({
      incident,
      timeline,
      report: {
        status: report.status,
        rootCause: report.rootCause,
        rootCauseCategory: report.rootCauseCategory,
        contributingFactors: report.contributingFactors,
        authoredByName,
        reviewedByName,
        publishedAt: report.publishedAt,
      },
      correctiveActions: actionsWithOwnerNames,
    });

    return { markdown };
  }

  private async resolveOwnerName(userId: string): Promise<string> {
    const name = await this.contextReader.getUserName(userId);
    return name ?? userId;
  }
}
