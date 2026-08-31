process.env.NODE_ENV ??= 'test';
process.env.LOG_LEVEL ??= 'fatal';
process.env.DATABASE_URL ??= 'postgresql://bankops:bankops@localhost:5432/bankops?schema=public';
process.env.FRONTEND_ORIGIN ??= 'http://localhost:3000';
process.env.JWT_SECRET ??= 'test-secret-must-be-at-least-32-chars';
process.env.JWT_EXPIRES_IN ??= '15m';
process.env.COOKIE_SECURE ??= 'false';
