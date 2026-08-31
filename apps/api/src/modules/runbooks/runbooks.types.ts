import type { IncidentRunbook, Runbook, RunbookCategory, RunbookOutcome } from '@prisma/client';

export interface CreateRunbookInput {
  title: string;
  slug: string;
  category: RunbookCategory;
  triggerCondition: string;
  steps: unknown;
  createdById: string;
}

export interface UpdateRunbookInput {
  title?: string | undefined;
  category?: RunbookCategory | undefined;
  triggerCondition?: string | undefined;
  steps?: unknown;
  isActive?: boolean | undefined;
}

export interface SearchRunbooksFilter {
  /** Free-text match against title and trigger condition. */
  query?: string | undefined;
  category?: RunbookCategory | undefined;
  isActive?: boolean | undefined;
}

export interface RunbooksRepository {
  search(filter: SearchRunbooksFilter): Promise<Runbook[]>;
  findById(id: string): Promise<Runbook | null>;
  findBySlug(slug: string): Promise<Runbook | null>;
  create(input: CreateRunbookInput): Promise<Runbook>;
  /** Edits bump `version` — see the schema note on why executions snapshot the version they ran. */
  update(id: string, input: UpdateRunbookInput): Promise<Runbook>;
  linkToIncident(
    incidentId: string,
    runbookId: string,
    runbookVersion: number,
  ): Promise<IncidentRunbook>;
  findLinkById(linkId: string): Promise<IncidentRunbook | null>;
  recordOutcome(
    linkId: string,
    outcome: RunbookOutcome,
    executedById: string | null,
    executedAutomatically: boolean,
  ): Promise<IncidentRunbook>;
  findLinksForIncident(incidentId: string): Promise<IncidentRunbook[]>;
}
