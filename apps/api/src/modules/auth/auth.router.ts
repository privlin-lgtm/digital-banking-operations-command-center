import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { loginHandler, logoutHandler, meHandler } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', loginHandler);
authRouter.post('/logout', authenticate, logoutHandler);
authRouter.get('/me', authenticate, meHandler);
