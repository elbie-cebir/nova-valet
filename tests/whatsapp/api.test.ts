import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { businessApiAdapter } from '@/lib/whatsapp/business-api';
import { verifyWhatsAppSignature } from '@/lib/whatsapp/signature';
import { parseWhatsAppEvents } from '@/lib/whatsapp/events';
import {
  localeToWaLang,
  resolveTemplateMessage,
  TEMPLATES,
} from '@/lib/whatsapp/templates';
import { createHmac } from 'node:crypto';

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
  vi.restoreAllMocks();
});

describe('businessApi adapter gate', () => {
  it('is enabled only when access token AND phone number id are set', () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'tok';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
    expect(businessApiAdapter.enabled).toBe(true);
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    expect(businessApiAdapter.enabled).toBe(false);
  });
});

describe('businessApi adapter send()', () => {
  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '555000';
    process.env.WHATSAPP_API_VERSION = 'v22.0';
  });

  it('POSTs a template payload to the Graph API and returns the message id', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.TEST' }] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const res = await businessApiAdapter.send({
      toPhone: '+32 470 12 34 56',
      template: 'booking_confirmation',
      languageCode: 'en',
      params: ['Jan', 'NV-ABC123'],
    });

    expect(res).toEqual({ sent: true, id: 'wamid.TEST' });
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe('https://graph.facebook.com/v22.0/555000/messages');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    const body = JSON.parse(init.body);
    expect(body.messaging_product).toBe('whatsapp');
    expect(body.to).toBe('32470123456'); // normalized, no +/spaces
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('booking_confirmation');
    expect(body.template.language.code).toBe('en');
    expect(body.template.components[0].parameters).toEqual([
      { type: 'text', text: 'Jan' },
      { type: 'text', text: 'NV-ABC123' },
    ]);
  });

  it('returns a non-throwing error result on a Graph API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'bad template' } }),
      })) as unknown as typeof fetch,
    );
    const res = await businessApiAdapter.send({
      toPhone: '32470123456',
      template: 'x',
      languageCode: 'en',
    });
    expect(res.sent).toBe(false);
    expect(res.error).toContain('bad template');
  });

  it('skips (no throw) when not configured', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const res = await businessApiAdapter.send({
      toPhone: '32470123456',
      template: 'x',
      languageCode: 'en',
    });
    expect(res).toEqual({ sent: false, skipped: true });
  });
});

describe('webhook signature verification', () => {
  const secret = 'app-secret';
  const raw = '{"hello":"world"}';
  const good =
    'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');

  it('accepts a valid X-Hub signature', () => {
    expect(verifyWhatsAppSignature(raw, good, secret)).toBe(true);
  });
  it('rejects a wrong signature, missing header, or wrong body', () => {
    expect(verifyWhatsAppSignature(raw, 'sha256=deadbeef', secret)).toBe(false);
    expect(verifyWhatsAppSignature(raw, null, secret)).toBe(false);
    expect(verifyWhatsAppSignature('{"tampered":1}', good, secret)).toBe(false);
  });
});

describe('parse webhook events', () => {
  it('extracts inbound message ids and status ids', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: 'wamid.IN1' }, { id: 'wamid.IN2' }],
                statuses: [{ id: 'wamid.ST1', status: 'delivered' }],
              },
            },
          ],
        },
      ],
    };
    expect(parseWhatsAppEvents(payload)).toEqual({
      messageIds: ['wamid.IN1', 'wamid.IN2'],
      statusIds: ['wamid.ST1'],
    });
    expect(parseWhatsAppEvents({})).toEqual({ messageIds: [], statusIds: [] });
  });
});

describe('template resolution + language', () => {
  it('maps booking locale to a WhatsApp language code', () => {
    expect(localeToWaLang('nl')).toBe('nl');
    expect(localeToWaLang('en')).toBe('en');
    expect(localeToWaLang('fr')).toBe('fr');
  });

  it('falls back to hello_world until templates are approved', () => {
    delete process.env.WHATSAPP_TEMPLATES_APPROVED;
    const real = {
      toPhone: '32470123456',
      template: TEMPLATES.confirmation,
      languageCode: 'en',
      params: ['a', 'b'],
    };
    const resolved = resolveTemplateMessage(real);
    expect(resolved.template).toBe('hello_world');
    expect(resolved.languageCode).toBe('en_US');
    expect(resolved.params).toEqual([]);
  });

  it('sends the real template once approved', () => {
    process.env.WHATSAPP_TEMPLATES_APPROVED = 'true';
    const real = {
      toPhone: '32470123456',
      template: TEMPLATES.confirmation,
      languageCode: 'nl',
      params: ['a'],
    };
    expect(resolveTemplateMessage(real)).toEqual(real);
  });
});
