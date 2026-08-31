import type { UserRole } from '@bankops/shared';
import type { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

export function authorize(...allowed: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!allowed.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}
