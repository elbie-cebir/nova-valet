import type { WhatsAppTemplateMessage } from './types';

/** Production Utility template names (created + approved in Meta). */
export const TEMPLATES = {
  confirmation: 'booking_confirmation',
  reminder: 'booking_reminder',
  balance: 'balance_due',
  onMyWay: 'on_my_way',
} as const;

/** Meta's built-in sample template — used for the live pipeline test before the
 * real templates are approved. Fixed language, no parameters. */
export const HELLO_WORLD: WhatsAppTemplateMessage = {
  toPhone: '',
  template: 'hello_world',
  languageCode: 'en_US',
  params: [],
};

/**
 * Booking locale → WhatsApp template language code. Emits EXACTLY `en` / `nl` /
 * `fr` — the language codes the templates were submitted under in Meta (never a
 * regional variant like `en_US`, which would be "template not found"). Unknown
 * locales fall back to `en`.
 */
export function localeToWaLang(locale: string): 'en' | 'nl' | 'fr' {
  const map: Record<string, 'en' | 'nl' | 'fr'> = {
    nl: 'nl',
    en: 'en',
    fr: 'fr',
  };
  return map[locale] ?? 'en';
}

/** Whether the real Utility templates have been approved in Meta yet. */
export function templatesApproved(): boolean {
  return process.env.WHATSAPP_TEMPLATES_APPROVED === 'true';
}

/**
 * Resolve the template to actually send. Until the real templates are approved,
 * every send falls back to Meta's `hello_world` sample (so the pipeline can be
 * tested live) while keeping the intended recipient.
 */
export function resolveTemplateMessage(
  msg: WhatsAppTemplateMessage,
): WhatsAppTemplateMessage {
  if (templatesApproved()) return msg;
  return { ...HELLO_WORLD, toPhone: msg.toPhone };
}
