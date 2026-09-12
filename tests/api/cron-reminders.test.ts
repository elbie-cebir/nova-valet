import { describe, it, expect, afterEach } from 'vitest';
import { GET } from '@/app/api/cron/reminders/route';

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

function req(auth?: string) {
  const headers: Record<string, string> = {};
  if (auth) headers.authorization = auth;
  return new Request('https://x/api/cron/reminders', { headers });
}

describe('cron reminders route auth (fails closed)', () => {
  it('rejects when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req('Bearer whatever'))).status).toBe(401);
  });

  it('rejects a missing or wrong bearer token', async () => {
    process.env.CRON_SECRET = 'sekret';
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer nope'))).status).toBe(401);
  });

  it('runs the sweep with the correct bearer token', async () => {
    process.env.CRON_SECRET = 'sekret';
    const res = await GET(req('Bearer sekret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.due).toBe('number');
  });
});
