import type { SlaWindow } from '@prisma/client';
import type { Logger } from 'pino';
import type { AuditLogger } from '../audit/audit-logger.js';
import { NotFoundError } from '../../lib/errors.js';
import type { ServicesRepository } from '../services/services.types.js';
import type { SlaCalculator } from './sla-calculator.js';
import type { SlaDataSource, SlaRecordsRepository } from './sla.types.js';

/** Applied to every service in the automatic rollup — see the class doc for why this isn't per-service configurable yet. */
const DEFAULT_TARGET_PERCENT = 99.9;

export interface RollupResult {
  processed: number;
  breaches: number;
}

/**
 * Orchestrates SLA tracking: gather raw window data (SlaDataSource),
 * run it through the pure calculator (SlaCalculator), and persist the
 * result (SlaRecordsRepository). Each of those is independently
 * testable; this class is the only place they're wired together, which
 * is what "SLA calculations" actually means operationally — not a
 * single formula, but a pipeline with a real database on one end.
 *
 * SLA targets are a single constant applied to every service in the
 * automatic rollup, not a per-service configurable column — this
 * platform has no dedicated "SLA target" config table yet. The manual
 * calculate endpoint accepts an explicit override for ad-hoc
 * recalculation against a different target.
 */
export class SlaTrackingService {
  constructor(
    private readonly dataSource: SlaDataSource,
    private readonly recordsRepository: SlaRecordsRepository,
    private readonly servicesRepository: ServicesRepository,
    private readonly calculator: SlaCalculator,
    private readonly auditLogger: AuditLogger,
    private readonly logger: Logger,
  ) {}

  async calculateForService(
    serviceId: string,
    windowType: SlaWindow,
    windowStart: Date,
    windowEnd: Date,
    targetPercent: number,
    actorId?: string,
  ) {
    const service = await this.servicesRepository.findById(serviceId);
    if (!service) {
      throw new NotFoundError(`Service "${serviceId}" not found`);
    }

    // A window still in progress (the current month, recomputed daily by
    // the rollup) has a windowEnd in the future. Neither the denominator
    // nor an open incident's downtime can extend past "now" — otherwise
    // an incident that's merely still open gets billed as downtime for
    // days that haven't happened yet, and a mid-month recompute would
    // report availability against a month that isn't over. windowEnd
    // itself is still stored on the record as the period's nominal
    // boundary; only the arithmetic uses the clamped value.
    const now = new Date();
    const effectiveEnd = windowEnd > now ? now : windowEnd;

    const windowMinutes = Math.max(0, (effectiveEnd.getTime() - windowStart.getTime()) / 60_000);
    const windowData = await this.dataSource.gatherWindowData(serviceId, windowStart, effectiveEnd);
    const result = this.calculator.calculate({ windowMinutes, targetPercent, ...windowData });

    const record = await this.recordsRepository.upsert({
      serviceId,
      windowType,
      windowStart,
      windowEnd,
      targetPercent,
      ...result,
    });

    this.logger.info(
      { serviceId, windowType, actualPercent: result.actualPercent, breached: result.breached },
      'SLA window calculated',
    );

    if (actorId) {
      await this.auditLogger.record({
        actorId,
        action: 'sla.calculate',
        entityType: 'Service',
        entityId: serviceId,
        metadata: { windowType, actualPercent: result.actualPercent, breached: result.breached },
      });
    }

    return record;
  }

  /**
   * The scheduled job: recompute the current calendar-month window for
   * every service. Safe to run as often as desired — each run just
   * upserts the same (service, MONTHLY, thisMonthStart) row with fresher
   * numbers, so a mid-month recompute is a refresh, not a duplicate.
   */
  async runRollup(
    actorId: string,
    targetPercent: number = DEFAULT_TARGET_PERCENT,
  ): Promise<RollupResult> {
    const services = await this.servicesRepository.findMany({});
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const windowEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    let breaches = 0;
    for (const service of services) {
      const record = await this.calculateForService(
        service.id,
        'MONTHLY',
        windowStart,
        windowEnd,
        targetPercent,
        actorId,
      );
      if (record.breached) {
        breaches += 1;
      }
    }

    this.logger.info({ processed: services.length, breaches }, 'SLA rollup complete');
    return { processed: services.length, breaches };
  }

  getLatest(serviceId: string, windowType: SlaWindow) {
    return this.recordsRepository.findLatest(serviceId, windowType);
  }

  getHistory(serviceId: string, windowType: SlaWindow, limit: number) {
    return this.recordsRepository.findHistory(serviceId, windowType, limit);
  }

  getCurrentBreaches(windowType: SlaWindow) {
    return this.recordsRepository.findCurrentBreaches(windowType);
  }
}
