import type { Queryable } from '@/lib/data/types';
import { getBookingContact, getBookingByReference } from '@/lib/data/booking';
import { getWhatsAppAdapter } from '@/lib/whatsapp';
import type {
  WhatsAppAdapter,
  WhatsAppSendResult,
  WhatsAppTemplateMessage,
} from '@/lib/whatsapp/types';
import {
  TEMPLATES,
  localeToWaLang,
  resolveTemplateMessage,
} from '@/lib/whatsapp/templates';
import { LOCALES } from '@/i18n/routing';
import { BUSINESS_TIMEZONE } from '@/config/constants';

interface NotifyContext {
  phone: string;
  name: string;
  reference: string;
  locale: string;
  slotStartAt: string;
  address: string;
  postcode: string;
}

async function loadContext(
  db: Queryable,
  bookingId: string,
): Promise<NotifyContext | null> {
  const contact = await getBookingContact(db, bookingId);
  if (!contact) return null;
  const b = await getBookingByReference(db, contact.reference);
  if (!b) return null;
  return {
    phone: b.customerPhone,
    name: b.customerName,
    reference: b.reference,
    locale: b.locale,
    slotStartAt: b.slotStartAt,
    address: b.address,
    postcode: b.postcode,
  };
}

function slotLabel(iso: string, locale: string): string {
  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;
  return new Intl.DateTimeFormat(bcp47, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE,
  }).format(new Date(iso));
}

/** booking_confirmation params: name, reference, slot, address (see B7 discovery). */
export function buildConfirmationTemplate(
  ctx: NotifyContext,
): WhatsAppTemplateMessage {
  return {
    toPhone: ctx.phone,
    template: TEMPLATES.confirmation,
    languageCode: localeToWaLang(ctx.locale),
    params: [
      ctx.name,
      ctx.reference,
      slotLabel(ctx.slotStartAt, ctx.locale),
      `${ctx.address}, ${ctx.postcode}`,
    ],
  };
}

/** booking_reminder params: name, slot, address. */
export function buildReminderTemplate(
  ctx: NotifyContext,
): WhatsAppTemplateMessage {
  return {
    toPhone: ctx.phone,
    template: TEMPLATES.reminder,
    languageCode: localeToWaLang(ctx.locale),
    params: [
      ctx.name,
      slotLabel(ctx.slotStartAt, ctx.locale),
      `${ctx.address}, ${ctx.postcode}`,
    ],
  };
}

export interface NotifyDeps {
  adapter?: WhatsAppAdapter;
}

async function routeTemplate(
  db: Queryable,
  bookingId: string,
  build: (ctx: NotifyContext) => WhatsAppTemplateMessage,
  deps: NotifyDeps,
): Promise<WhatsAppSendResult> {
  const adapter = deps.adapter ?? getWhatsAppAdapter();
  // Only the Cloud API adapter auto-sends; manual stays owner-tap.
  if (adapter.name !== 'businessApi') return { sent: false, skipped: true };
  try {
    const ctx = await loadContext(db, bookingId);
    if (!ctx || !ctx.phone) return { sent: false, skipped: true };
    // Gated: falls back to hello_world until the real templates are approved.
    const msg = resolveTemplateMessage(build(ctx));
    return await adapter.send(msg);
  } catch (e) {
    // Failure-safe: a send error must never break a verified confirm.
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Auto-sent on a provider-verified deposit (from the webhook confirm path). */
export function notifyBookingConfirmed(
  db: Queryable,
  bookingId: string,
  deps: NotifyDeps = {},
): Promise<WhatsAppSendResult> {
  return routeTemplate(db, bookingId, buildConfirmationTemplate, deps);
}

/** Reminder seam (scheduling lands with ops; routes the same way). */
export function notifyBookingReminder(
  db: Queryable,
  bookingId: string,
  deps: NotifyDeps = {},
): Promise<WhatsAppSendResult> {
  return routeTemplate(db, bookingId, buildReminderTemplate, deps);
}
