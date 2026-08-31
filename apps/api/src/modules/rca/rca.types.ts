import type {
  CorrectiveAction,
  CorrectiveActionType,
  RcaReport,
  RcaRootCauseCategory,
  RcaStatus,
} from '@prisma/client';

export interface CreateRcaReportInput {
  incidentId: string;
  rootCause: string;
  rootCauseCategory: RcaRootCauseCategory;
  contributingFactors?: string | undefined;
  authoredById: string;
}

export interface UpdateRcaReportInput {
  rootCause?: string | undefined;
  rootCauseCategory?: RcaRootCauseCategory | undefined;
  contributingFactors?: string | undefined;
}

export interface CreateCorrectiveActionInput {
  rcaReportId: string;
  type: CorrectiveActionType;
  description: string;
  ownerId: string;
  dueDate?: Date | undefined;
}

export interface RcaReportsRepository {
  findById(id: string): Promise<RcaReport | null>;
  findByIncidentId(incidentId: string): Promise<RcaReport | null>;
  create(input: CreateRcaReportInput): Promise<RcaReport>;
  update(id: string, input: UpdateRcaReportInput): Promise<RcaReport>;
  transitionStatus(
    id: string,
    status: RcaStatus,
    fields: { reviewedById?: string; publishedAt?: Date },
  ): Promise<RcaReport>;
  addCorrectiveAction(input: CreateCorrectiveActionInput): Promise<CorrectiveAction>;
  findCorrectiveAction(id: string): Promise<CorrectiveAction | null>;
  markCorrectiveActionComplete(id: string): Promise<CorrectiveAction>;
  findCorrectiveActionsByReportId(rcaReportId: string): Promise<CorrectiveAction[]>;
  /** Every open corrective/preventive action across all RCAs, for a "what's outstanding" dashboard — the query the schema's original design note promised this table would enable. */
  findOpenActions(filter: {
    ownerId?: string | undefined;
    type?: CorrectiveActionType | undefined;
  }): Promise<CorrectiveAction[]>;
}
