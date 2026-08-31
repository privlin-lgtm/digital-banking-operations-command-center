import type { Metric } from '@prisma/client';
import type { ParamsDictionary, Request, Response } from 'express-serve-static-core';
import { requireUser } from '../../lib/require-user.js';
import type { AlertsService } from '../alerts/alerts.service.js';
import type { ListMetricsQuery, RecordMetricBody } from './service-metrics.schema.js';
import type { ServiceHealthService } from './service-metrics.service.js';

/**
 * `Metric.id` is a `BigInt` at the persistence layer (see the schema
 * rationale: sequential integer PKs keep this append-only, high-volume
 * table's indexes small). `JSON.stringify` — and therefore `res.json()`
 * — cannot serialize a `bigint` at all; it throws instead of silently
 * truncating. Wire-format translation is exactly the controller's job:
 * the domain/repository layers keep the real bigint, and only the HTTP
 * boundary downgrades it to a string.
 */
function serializeMetric(metric: Metric) {
  return { ...metric, id: metric.id.toString() };
}

export class ServiceHealthController {
  constructor(
    private readonly healthService: ServiceHealthService,
    private readonly alertsService: AlertsService,
  ) {}

  list = async (
    req: Request<{ id: string } & ParamsDictionary, unknown, unknown, ListMetricsQuery>,
    res: Response,
  ): Promise<void> => {
    const metrics = await this.healthService.listMetrics(req.params.id, req.query);
    res.json({ data: metrics.map(serializeMetric) });
  };

  snapshot = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    // LatestMetricSnapshot carries no id column, so no BigInt to translate.
    const data = await this.healthService.getHealthSnapshot(req.params.id);
    res.json({ data });
  };

  /**
   * Recording a metric and evaluating it against any configured alert
   * rule happen back to back, in the same request — there's no polling
   * loop between "a sample arrived" and "check if it breaches a
   * threshold." See AlertsService.evaluateMetric for why that's the
   * whole engine's trigger, not a scheduled sweep.
   */
  record = async (
    req: Request<{ id: string }, unknown, RecordMetricBody>,
    res: Response,
  ): Promise<void> => {
    const user = requireUser(req);
    const metric = await this.healthService.recordMetric(req.params.id, req.body);
    await this.alertsService.evaluateMetric(
      req.params.id,
      req.body.metricName,
      req.body.value,
      user.id,
      user.role,
    );
    res.status(201).json({ data: serializeMetric(metric) });
  };
}
