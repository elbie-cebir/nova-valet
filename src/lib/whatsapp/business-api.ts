import type { WhatsAppAdapter, WhatsAppMessage } from './types';
import { buildWaLink } from './link';

/**
 * WhatsApp Business API adapter — BASE LAYER ONLY, config-gated, OFF by default.
 * WABA approval is in process; this must not be wired live. It is enabled only
 * when both credentials are present, and even then `send()` is intentionally
 * unimplemented until approval lands. It still exposes `buildLink` so the owner
 * can always fall back to a tap link.
 */
export const businessApiAdapter: WhatsAppAdapter = {
  name: 'businessApi',
  enabled: Boolean(
    process.env.WHATSAPP_BUSINESS_API_TOKEN &&
    process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID,
  ),
  buildLink(msg: WhatsAppMessage): string | null {
    return buildWaLink(msg);
  },
  async send(): Promise<void> {
    throw new Error(
      'whatsapp: businessApi send is not wired (base layer only, gated until WABA approval)',
    );
  },
};
