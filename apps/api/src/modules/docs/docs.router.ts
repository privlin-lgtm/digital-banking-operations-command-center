import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import yaml from 'js-yaml';
import swaggerUi, { type JsonObject } from 'swagger-ui-express';

/**
 * Closes two findings from the same review: the README's hand-maintained
 * route table had silently drifted out of sync with the real router files
 * (missing five entire modules), and there was no machine-readable API
 * contract at all. openapi.yaml is checked in at the api package root and
 * loaded once at startup — a contract that has to be read from disk and
 * parsed to be served is a contract someone will actually keep in sync,
 * unlike a markdown table nobody re-generates.
 */
const openApiPath = fileURLToPath(new URL('../../../openapi.yaml', import.meta.url));
const openApiDocument = yaml.load(readFileSync(openApiPath, 'utf8')) as JsonObject;

export function createDocsRouter(): Router {
  const router = Router();
  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, { customSiteTitle: 'BankOps API' }),
  );
  return router;
}
