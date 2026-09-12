import { describe, it, expect, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { GET, POST } from '@/app/api/webhooks/whatsapp/route';
import { dedupeNewIds } from '@/lib/whatsapp/events';

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

const VERIFY = 'verify-abc';
const SECRET = 'app-secret';

describe('GET webhook verification', () => {
  it('echoes hub.challenge when the verify token matches', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = VERIFY;
    const url = `https://x/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=CHALLENGE123`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('CHALLENGE123');
  });

  it('rejects a wrong or missing verify token', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = VERIFY;
    const bad = `https://x/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=C`;
    expect((await GET(new Request(bad))).status).toBe(403);
  });
});

describe('POST webhook signature', () => {
  function req(body: string, sig: string | null) {
    const headers: Record<string, string> = {};
    if (sig) headers['x-hub-signature-256'] = sig;
    return new Request('https://x/api/webhooks/whatsapp', {
      method: 'POST',
      headers,
      body,
    });
  }

  it('accepts a correctly signed body', async () => {
    process.env.WHATSAPP_APP_SECRET = SECRET;
    const body = JSON.stringify({ entry: [] });
    const sig =
      'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');
    const res = await POST(req(body, sig));
    expect(res.status).toBe(200);
  });

  it('rejects an unsigned or wrongly-signed body', async () => {
    process.env.WHATSAPP_APP_SECRET = SECRET;
    const body = JSON.stringify({ entry: [] });
    expect((await POST(req(body, null))).status).toBe(401);
    expect((await POST(req(body, 'sha256=nope'))).status).toBe(401);
  });
});

describe('idempotency on message id', () => {
  it('only reports each id as new once', () => {
    const seen = new Set<string>();
    expect(dedupeNewIds(['a', 'b'], seen)).toEqual(['a', 'b']);
    expect(dedupeNewIds(['a', 'b', 'c'], seen)).toEqual(['c']); // a,b already seen
    expect(dedupeNewIds(['a'], seen)).toEqual([]);
  });
});
