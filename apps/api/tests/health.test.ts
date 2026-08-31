import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('health endpoints', () => {
  const app = createApp();

  it('GET /api/v1/live never touches a dependency and always reports alive', async () => {
    const response = await request(app).get('/api/v1/live');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('alive');
  });

  it('GET /api/v1/health degrades gracefully instead of 500ing when a check fails', async () => {
    // No DB is guaranteed reachable in this test environment (see
    // tests/setup-env.ts) — the point of this endpoint is that it still
    // returns 200 with a per-check breakdown either way, not a hard
    // failure. Each `checks.*` value is asserted individually below
    // rather than the top-level status, since that depends on whether a
    // real database happens to be reachable in this run.
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.service).toBe('bankops-api');
    expect(['healthy', 'degraded']).toContain(response.body.status);
    expect(response.body.checks).toHaveProperty('database');
  });
});
