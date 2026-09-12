/**
 * The ONE WhatsApp interface, with two adapters behind it:
 *  - `manual`     — live. Produces `wa.me` tap links for the owner; never sends
 *                   programmatically (`send()` reports skipped).
 *  - `businessApi`— Cloud API. `send()` posts a template message via the Graph
 *                   API. Config-gated: only sends when credentials are present.
 */

/** A free-text message target — used for `wa.me` tap links. */
export interface WhatsAppMessage {
  toPhone: string;
  body: string;
}

/**
 * A Cloud API template message: a pre-approved template name, its language, and
 * ordered body parameters. Business-initiated sends outside the 24h window must
 * be templates (Meta rule).
 */
export interface WhatsAppTemplateMessage {
  toPhone: string;
  template: string;
  languageCode: string;
  params?: string[];
}

/** Result of a send attempt. Never thrown — always returned, so a send failure
 * can never break a verified confirm (same discipline as the email seam). */
export interface WhatsAppSendResult {
  sent: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

export interface WhatsAppAdapter {
  readonly name: 'manual' | 'businessApi';
  /** Whether this adapter is enabled in the current environment. */
  readonly enabled: boolean;
  /** A `wa.me` tap link for the owner, or null if there is no valid number. */
  buildLink(msg: WhatsAppMessage): string | null;
  /** Send a template message. Manual reports skipped; businessApi posts to Graph. */
  send(msg: WhatsAppTemplateMessage): Promise<WhatsAppSendResult>;
}
