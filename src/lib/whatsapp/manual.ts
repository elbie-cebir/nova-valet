import type { WhatsAppAdapter, WhatsAppMessage } from './types';
import { buildWaLink } from './link';

/**
 * The live adapter. It never sends anything — it only builds a `wa.me` tap link
 * for the owner to open. Always enabled.
 */
export const manualAdapter: WhatsAppAdapter = {
  name: 'manual',
  enabled: true,
  buildLink(msg: WhatsAppMessage): string | null {
    return buildWaLink(msg);
  },
  async send(): Promise<void> {
    throw new Error(
      'whatsapp: manual adapter cannot send — the owner taps a wa.me link',
    );
  },
};
