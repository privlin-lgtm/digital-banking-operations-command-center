import type {
  NextFunction,
  ParamsDictionary,
  Request,
  RequestHandler,
  Response,
} from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

type AsyncRoute<P, ResBody, ReqBody, ReqQuery> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
>(fn: AsyncRoute<P, ResBody, ReqBody, ReqQuery>): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}
