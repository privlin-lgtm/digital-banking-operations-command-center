import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createRateLimitStore } from '../../lib/rate-limit-store.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loginHandler, logoutHandler, meHandler } from './auth.controller.js';

export const authRouter = Router();

// The app-wide limiter in app.ts (120 req/min) is sized for general API
// traffic, not credential guessing — at that rate an attacker gets 120
// password attempts per minute per IP. Login gets its own much tighter
// budget on top of it, keyed the same way (by IP), since this is the one
// endpoint where "a burst of requests" specifically means "a burst of
// guesses against someone's password."
const loginRateLimitStore = createRateLimitStore('login');
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, try again later' } },
  ...(loginRateLimitStore ? { store: loginRateLimitStore } : {}),
});

authRouter.post('/login', loginLimiter, loginHandler);
authRouter.post('/logout', authenticate, logoutHandler);
authRouter.get('/me', authenticate, meHandler);
