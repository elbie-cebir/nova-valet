import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkTemplatesApproved } from '@/lib/whatsapp/template-status';

const ENV = { ...process.env };
beforeEach(() => {
  process.env.WHATSAPP_ACCESS_TOKEN = 'tok';
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = 'waba123';
});
afterEach(() => {
  process.env = { ...ENV };
});

function fakeFetch(templates: { name: string; status: string }[]) {
  return (async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: templates }),
  })) as unknown as typeof fetch;
}

describe('template pre-flight check', () => {
  it('is ok only when every required template has an APPROVED version', async () => {
    const res = await checkTemplatesApproved(
      ['booking_confirmation', 'booking_reminder'],
      {
        fetchImpl: fakeFetch([
          { name: 'booking_confirmation', status: 'APPROVED' },
          { name: 'booking_reminder', status: 'APPROVED' },
        ]),
      },
    );
    expect(res.ok).toBe(true);
    expect(res.missing).toEqual([]);
    expect(res.approved).toEqual(['booking_confirmation', 'booking_reminder']);
  });

  it('reports missing / not-yet-approved templates with their status', async () => {
    const res = await checkTemplatesApproved(
      ['booking_confirmation', 'booking_reminder', 'balance_due'],
      {
        fetchImpl: fakeFetch([
          { name: 'booking_confirmation', status: 'APPROVED' },
          { name: 'booking_reminder', status: 'PENDING' },
          // balance_due absent entirely
        ]),
      },
    );
    expect(res.ok).toBe(false);
    expect(res.approved).toEqual(['booking_confirmation']);
    expect(res.missing).toEqual([
      { name: 'booking_reminder', status: 'PENDING' },
      { name: 'balance_due', status: 'MISSING' },
    ]);
  });

  it('fails closed (not ok) when the WABA cannot be queried', async () => {
    const res = await checkTemplatesApproved(['booking_confirmation'], {
      fetchImpl: (async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'bad token' } }),
      })) as unknown as typeof fetch,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('bad token');
    expect(res.missing[0]).toEqual({
      name: 'booking_confirmation',
      status: 'unverified',
    });
  });
});
