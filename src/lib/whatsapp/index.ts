import type { WhatsAppAdapter } from './types';
import { manualAdapter } from './manual';
import { businessApiAdapter } from './business-api';

export type { WhatsAppAdapter, WhatsAppMessage } from './types';
export { buildWaLink, normalizeWaNumber } from './link';
export { manualAdapter } from './manual';

/**
 * Select the active adapter from `WHATSAPP_ADAPTER`. Defaults to `manual` (live).
 * `businessApi` is only honoured when it is actually enabled (both creds set);
 * otherwise we fall back to manual so the owner-tap flow never breaks.
 */
export function getWhatsAppAdapter(): WhatsAppAdapter {
  if (
    process.env.WHATSAPP_ADAPTER === 'businessApi' &&
    businessApiAdapter.enabled
  ) {
    return businessApiAdapter;
  }
  return manualAdapter;
}
