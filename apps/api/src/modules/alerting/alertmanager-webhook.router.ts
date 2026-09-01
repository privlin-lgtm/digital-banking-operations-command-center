import { Router, type RequestHandler } from 'express';
import { loadEnv } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { recordAlertNotification } from '../../config/metrics.js';

/** The subset of Alertmanager's webhook payload (v4) this receiver actually reads. */
interface AlertmanagerAlert {
  status: 'firing' | 'resolved';
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
}

interface AlertmanagerWebhookPayload {
  receiver: string;
  status: 'firing' | 'resolved';
  alerts: AlertmanagerAlert[];
}

/**
 * Alertmanager can't authenticate as a BankOps user (there's no such
 * concept for it), so this isn't behind the normal JWT `authenticate`
 * middleware — it's behind a bearer shared secret instead, configured on
 * both sides (this env var, and alertmanager.yml's http_config.authorization).
 * Constant-time comparison isn't worth it here: unlike a login password
 * this secret isn't guessable-by-similarity in a way timing meaningfully
 * narrows, and it's rotated by redeploying both sides together.
 */
function requireWebhookSecret(): RequestHandler {
  return (req, res, next) => {
    const env = loadEnv();
    const header = req.header('authorization');
    if (header !== `Bearer ${env.ALERTMANAGER_WEBHOOK_SECRET}`) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'Invalid webhook credentials' } });
      return;
    }
    next();
  };
}

/**
 * Closes the gap the production-readiness audit's P0 finding identified:
 * a rule firing inside Prometheus was previously a fact nobody outside
 * Prometheus's own UI could observe. This is the delivery side — logged
 * at a level matching severity, and counted via
 * bankops_alert_notifications_total so "is anything actually being
 * delivered" is itself an observable signal, not just an assumption.
 */
export function createAlertmanagerWebhookRouter(): Router {
  const router = Router();

  router.post('/webhook', requireWebhookSecret(), (req, res) => {
    const payload = req.body as AlertmanagerWebhookPayload;
    const alerts = payload.alerts ?? [];

    for (const alert of alerts) {
      const severity = alert.labels.severity ?? 'unknown';
      const alertname = alert.labels.alertname ?? 'unknown';
      const logLevel = severity === 'critical' ? 'error' : 'warn';

      logger[logLevel](
        {
          alertname,
          severity,
          status: alert.status,
          summary: alert.annotations.summary,
          description: alert.annotations.description,
          startsAt: alert.startsAt,
          endsAt: alert.endsAt,
        },
        `Alertmanager: ${alertname} is ${alert.status}`,
      );

      recordAlertNotification(severity, alert.status);
    }

    res.status(200).json({ received: alerts.length });
  });

  return router;
}
