import type {
  WhatsAppAdapter,
  WhatsAppMessage,
  WhatsAppSendResult,
  WhatsAppTemplateMessage,
} from './types';
import { buildWaLink, normalizeWaNumber } from './link';

const DEFAULT_API_VERSION = 'v22.0';

function config(): { token: string; phoneId: string; version: string } | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return null;
  return {
    token,
    phoneId,
    version: process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION,
  };
}

/**
 * WhatsApp Cloud API adapter. `send()` posts a template message to the Graph API.
 * Config-gated: `enabled` (and `send`) require both the access token and the
 * phone-number id. Errors are CAUGHT and returned as `{ sent: false, error }` —
 * a send failure must never break the (already provider-verified) booking
 * confirm, exactly like the email seam.
 */
export const businessApiAdapter: WhatsAppAdapter = {
  name: 'businessApi',
  // Read at access time so the gate reflects the current environment.
  get enabled(): boolean {
    return config() !== null;
  },

  buildLink(msg: WhatsAppMessage): string | null {
    return buildWaLink(msg);
  },

  async send(msg: WhatsAppTemplateMessage): Promise<WhatsAppSendResult> {
    const cfg = config();
    if (!cfg) return { sent: false, skipped: true };

    const url = `https://graph.facebook.com/${cfg.version}/${cfg.phoneId}/messages`;
    const template: Record<string, unknown> = {
      name: msg.template,
      language: { code: msg.languageCode },
    };
    if (msg.params && msg.params.length > 0) {
      template.components = [
        {
          type: 'body',
          parameters: msg.params.map((text) => ({ type: 'text', text })),
        },
      ];
    }
    const payload = {
      messaging_product: 'whatsapp',
      to: normalizeWaNumber(msg.toPhone),
      type: 'template',
      template,
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
        messages?: { id?: string }[];
      };
      if (!res.ok) {
        return {
          sent: false,
          error: data?.error?.message ?? `graph_error_${res.status}`,
        };
      }
      return { sent: true, id: data?.messages?.[0]?.id };
    } catch (e) {
      return { sent: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
