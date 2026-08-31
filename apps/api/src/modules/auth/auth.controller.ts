import type { CookieOptions, Request, Response } from 'express';
import { loadEnv } from '../../config/env.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { ACCESS_COOKIE, login, logout } from './auth.service.js';
import { loginSchema } from './auth.schema.js';

function cookieOptions(): CookieOptions {
  const env = loadEnv();
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    path: '/',
  };
}

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);
  const result = await login(body);

  res.cookie(ACCESS_COOKIE, result.accessToken, cookieOptions());
  res.status(200).json(result);
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await logout(req.user.id);
  }
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.status(204).send();
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ user: req.user });
});
