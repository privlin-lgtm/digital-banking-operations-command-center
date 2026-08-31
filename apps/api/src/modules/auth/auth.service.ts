import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { loadEnv } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { UnauthorizedError } from '../../lib/errors.js';
import type { AccessTokenPayload } from './auth.types.js';
import type { LoginInput } from './auth.schema.js';

export const ACCESS_COOKIE = 'bankops_access';

// Not a real user's hash — just something for bcrypt.compare to spend the
// same ~100ms against when the account lookup below comes back empty, so
// "no such email" and "wrong password" take the same amount of time. Skip
// that compare entirely (as this used to) and the two cases are trivially
// distinguishable by response time, which is a user-enumeration oracle:
// an attacker can find out which emails have accounts without ever
// guessing a password.
const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8gY9UZmSVXExtCEs6X5aVGtcnwlpVi';

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });

  const matches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !matches) {
    throw new UnauthorizedError('Invalid credentials');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
    },
  });

  const env = loadEnv();
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const signOptions: SignOptions = {
    issuer: 'bankops-api',
  };
  signOptions.expiresIn = env.JWT_EXPIRES_IN as NonNullable<SignOptions['expiresIn']>;

  const accessToken = jwt.sign(payload, env.JWT_SECRET, signOptions);

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    },
  };
}

export async function logout(userId: string): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: userId,
    },
  });
}
