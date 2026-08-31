import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { AppError } from '../lib/errors.js';

function errorContext(req: Parameters<ErrorRequestHandler>[1]) {
  return {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
  };
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    logger.warn({ ...errorContext(req), issues: err.issues }, 'Request validation failed');
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues,
        requestId: req.requestId,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    // Operational errors (404, 409, 403...) are expected traffic, not
    // incidents — logged at warn with full context so they're still
    // searchable/graphable, but they don't page anyone the way an
    // unhandled 500 below does.
    logger.warn({ ...errorContext(req), code: err.code, statusCode: err.statusCode }, err.message);
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId: req.requestId,
      },
    });
    return;
  }

  logger.error({ ...errorContext(req), err }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: req.requestId,
    },
  });
};
