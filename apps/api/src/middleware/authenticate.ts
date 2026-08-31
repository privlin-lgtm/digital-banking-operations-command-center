import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { loadEnv } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError, UnauthorizedError } from '../lib/errors.js';
import type { AccessTokenPayload } from '../modules/auth/auth.types.js';

const ACCESS_COOKIE = 'bankops_access';

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const env = loadEnv();
    const bearer = req.header('authorization');
    const tokenFromHeader = bearer?.startsWith('Bearer ') ? bearer.slice(7) : undefined;
    const token = tokenFromHeader ?? req.cookies?.[ACCESS_COOKIE];

    if (!token) {
      throw new UnauthorizedError();
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Account is disabled or does not exist');
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error instanceof AppError ? error : new UnauthorizedError('Invalid or expired token'));
  }
};
