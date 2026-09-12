/**
 * The ONE WhatsApp interface, with two adapters behind it:
 *  - `manual`     — live now. Produces `wa.me` tap links for the owner; no
 *                   messages are ever sent programmatically.
 *  - `businessApi`— base layer only, config-gated, OFF until WABA approval.
 *                   `send()` exists as a seam but is not wired.
 *
 * A message targets a phone number and carries a ready-to-send body.
 */
export interface WhatsAppMessage {
  toPhone: string;
  body: string;
}

export interface WhatsAppAdapter {
  readonly name: 'manual' | 'businessApi';
  /** Whether this adapter is enabled in the current environment. */
  readonly enabled: boolean;
  /**
   * A `wa.me` tap link for the owner, or null if no valid number. The manual
   * adapter's whole job; the businessApi adapter also exposes it for fallback.
   */
  buildLink(msg: WhatsAppMessage): string | null;
  /**
   * Programmatic send. Implemented only by a live businessApi adapter; the
   * manual adapter throws (there is nothing to send — the owner taps a link).
   */
  send(msg: WhatsAppMessage): Promise<void>;
}
