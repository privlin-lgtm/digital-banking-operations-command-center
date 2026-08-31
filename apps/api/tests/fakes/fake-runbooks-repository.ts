import type { IncidentRunbook, Prisma, Runbook, RunbookOutcome } from '@prisma/client';
import type {
  CreateRunbookInput,
  RunbooksRepository,
  SearchRunbooksFilter,
  UpdateRunbookInput,
} from '../../src/modules/runbooks/runbooks.types.js';
import type { IncidentLookup } from '../../src/modules/runbooks/incident-lookup.js';

let idCounter = 0;

export function makeRunbook(overrides: Partial<Runbook> = {}): Runbook {
  idCounter += 1;
  const now = new Date();
  return {
    id: overrides.id ?? `rb-${idCounter}`,
    title: overrides.title ?? 'Restart the thing',
    slug: overrides.slug ?? `restart-the-thing-${idCounter}`,
    category: overrides.category ?? 'INFRASTRUCTURE',
    triggerCondition: overrides.triggerCondition ?? 'thing is broken',
    steps: overrides.steps ?? ([{ order: 1, action: 'restart' }] as unknown as Prisma.JsonValue),
    version: overrides.version ?? 1,
    isActive: overrides.isActive ?? true,
    createdById: overrides.createdById ?? 'user-1',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export class FakeRunbooksRepository implements RunbooksRepository {
  private readonly rows = new Map<string, Runbook>();
  private readonly links = new Map<string, IncidentRunbook>();
  private linkCounter = 0;

  seed(runbook: Runbook): Runbook {
    this.rows.set(runbook.id, runbook);
    return runbook;
  }

  async search(filter: SearchRunbooksFilter): Promise<Runbook[]> {
    return [...this.rows.values()].filter(
      (runbook) =>
        (!filter.category || runbook.category === filter.category) &&
        (filter.isActive === undefined || runbook.isActive === filter.isActive) &&
        (!filter.query ||
          runbook.title.toLowerCase().includes(filter.query.toLowerCase()) ||
          runbook.triggerCondition.toLowerCase().includes(filter.query.toLowerCase())),
    );
  }

  async findById(id: string): Promise<Runbook | null> {
    return this.rows.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Runbook | null> {
    return [...this.rows.values()].find((runbook) => runbook.slug === slug) ?? null;
  }

  async create(input: CreateRunbookInput): Promise<Runbook> {
    const runbook = makeRunbook({ ...input, steps: input.steps as Prisma.JsonValue });
    this.rows.set(runbook.id, runbook);
    return runbook;
  }

  async update(id: string, input: UpdateRunbookInput): Promise<Runbook> {
    const existing = this.rows.get(id);
    if (!existing) {
      throw new Error(`FakeRunbooksRepository: "${id}" not found`);
    }
    const updated: Runbook = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.triggerCondition !== undefined ? { triggerCondition: input.triggerCondition } : {}),
      ...(input.steps !== undefined ? { steps: input.steps as Prisma.JsonValue } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      version: existing.version + 1,
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async linkToIncident(
    incidentId: string,
    runbookId: string,
    runbookVersion: number,
  ): Promise<IncidentRunbook> {
    this.linkCounter += 1;
    const link: IncidentRunbook = {
      id: `link-${this.linkCounter}`,
      incidentId,
      runbookId,
      runbookVersion,
      executedById: null,
      executedAutomatically: false,
      outcome: 'PENDING',
      executedAt: new Date(),
    };
    this.links.set(link.id, link);
    return link;
  }

  async findLinkById(linkId: string): Promise<IncidentRunbook | null> {
    return this.links.get(linkId) ?? null;
  }

  async recordOutcome(
    linkId: string,
    outcome: RunbookOutcome,
    executedById: string | null,
    executedAutomatically: boolean,
  ): Promise<IncidentRunbook> {
    const existing = this.links.get(linkId);
    if (!existing) {
      throw new Error(`FakeRunbooksRepository: link "${linkId}" not found`);
    }
    const updated: IncidentRunbook = {
      ...existing,
      outcome,
      executedById,
      executedAutomatically,
      executedAt: new Date(),
    };
    this.links.set(linkId, updated);
    return updated;
  }

  async findLinksForIncident(incidentId: string): Promise<IncidentRunbook[]> {
    return [...this.links.values()].filter((link) => link.incidentId === incidentId);
  }
}

export class FakeIncidentLookup implements IncidentLookup {
  existingIncidentIds = new Set<string>();

  async exists(incidentId: string): Promise<boolean> {
    return this.existingIncidentIds.has(incidentId);
  }
}
