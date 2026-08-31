import type { Request } from 'express';
import type { AuthenticatedUser } from '../modules/auth/auth.types.js';
import { UnauthorizedError } from './errors.js';

/**
 * Every route that calls this is already behind `authenticate`, so
 * `req.user` is always set in practice. This exists anyway because
 * `req.user` is typed optional (see `types/express.d.ts`) — narrowing it
 * explicitly beats a non-null assertion scattered across every controller
 * that needs to know "who did this" for audit logging.
 */
export function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user;
}
