import type {
  WhatsAppAdapter,
  WhatsAppMessage,
  WhatsAppSendResult,
} from './types';
import { buildWaLink } from './link';

/**
 * The manual adapter. It never sends anything programmatically — it only builds
 * a `wa.me` tap link for the owner. `send()` reports skipped (owner-tap is the
 * delivery mechanism), never throwing.
 */
export const manualAdapter: WhatsAppAdapter = {
  name: 'manual',
  enabled: true,
  buildLink(msg: WhatsAppMessage): string | null {
    return buildWaLink(msg);
  },
  async send(): Promise<WhatsAppSendResult> {
    return { sent: false, skipped: true };
  },
  async sendText(): Promise<WhatsAppSendResult> {
    return { sent: false, skipped: true };
  },
};
