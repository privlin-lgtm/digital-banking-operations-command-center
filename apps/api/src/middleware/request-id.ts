import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { runWithRequestContext } from '../lib/request-context.js';

export const REQUEST_ID_HEADER = 'x-request-id';

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming && incoming.trim().length > 0 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  // Everything downstream of `next()` — every remaining middleware, route
  // handler, service call, and repository call for this request — runs
  // inside this context, which is what lets config/logger.ts attach the
  // id to a log line with no `req` in scope.
  runWithRequestContext({ requestId: id }, next);
};
