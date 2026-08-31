import type {
  NextFunction,
  ParamsDictionary,
  RequestHandler,
  Response,
} from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import type { ZodType } from 'zod';

interface ValidationSchemas<P, ReqBody, ReqQuery> {
  body?: ZodType<ReqBody>;
  query?: ZodType<ReqQuery>;
  params?: ZodType<P>;
}

/**
 * Express 5 made `req.query` a getter-only accessor (it's derived lazily
 * from the raw URL), so a plain `req.query = parsed` throws
 * "Cannot set property query of #<IncomingMessage> which has only a
 * getter" at runtime — a real gap in Express 5's own type definitions,
 * which still declare `query` as writable. `req.params` and `req.body`
 * remain plain writable properties; `defineProperty` re-declares `query`
 * as a normal data property scoped to this one request so downstream
 * handlers see the parsed, defaulted, type-coerced value.
 */
function overwriteQuery(req: object, value: unknown): void {
  Object.defineProperty(req, 'query', {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/**
 * Generalizes the "parse this part of the request, 422 on failure" pattern
 * into one reusable middleware instead of each controller calling
 * `schema.parse(req.body)` inline. Thrown ZodErrors are handed to `next()`
 * and caught by the existing centralized error handler, which already
 * knows how to render a ZodError as a 422 — this middleware adds no new
 * error-handling path, it just moves parsing out of controllers.
 *
 * Generic over P/ReqBody/ReqQuery (inferred from the schemas passed in) so
 * the RequestHandler this returns actually types-match a controller that
 * expects the parsed shape — a non-generic version defaults to
 * `RequestHandler` (ParsedQs/`any` everywhere), which type-checks the
 * middleware itself fine but silently stops Express from verifying that
 * the next handler in the chain agrees with what got validated.
 */
export function validate<P = ParamsDictionary, ReqBody = unknown, ReqQuery = ParsedQs>(
  schemas: ValidationSchemas<P, ReqBody, ReqQuery>,
): RequestHandler<P, unknown, ReqBody, ReqQuery> {
  return (req, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        overwriteQuery(req, schemas.query.parse(req.query));
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
