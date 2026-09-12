import { getTranslations } from 'next-intl/server';
import type { Queryable } from '@/lib/data/types';
import { getBookingContact } from '@/lib/data/booking';
import { issueMagicLink } from '@/lib/data/token';
import { sendEmail, type EmailResult } from './email';
import { notifyBookingConfirmed } from './whatsapp';
import type { WhatsAppSendResult } from '@/lib/whatsapp/types';
import { bookingUrl } from '@/lib/url';

/** Compose + send the localized confirmation email carrying the magic link. */
export async function sendConfirmationEmail(opts: {
  to: string;
  locale: string;
  reference: string;
  magicLinkUrl: string;
}): Promise<EmailResult> {
  const t = await getTranslations({
    locale: opts.locale,
    namespace: 'Email',
  });
  const subject = t('confirmSubject', { reference: opts.reference });
  const html = `<div style="font-family:sans-serif;line-height:1.5;color:#0B0C0A">
  <h1 style="font-size:20px">${t('confirmHeading')}</h1>
  <p>${t('confirmBody', { reference: opts.reference })}</p>
  <p><a href="${opts.magicLinkUrl}" style="display:inline-block;background:#D6F04D;color:#0B0C0A;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">${t('openBooking')}</a></p>
  <p style="color:#6F6D66;font-size:13px">${t('linkFallback')}<br>${opts.magicLinkUrl}</p>
</div>`;
  const text = `${t('confirmHeading')}\n\n${t('confirmBody', { reference: opts.reference })}\n\n${t('openBooking')}: ${opts.magicLinkUrl}`;
  return sendEmail({ to: opts.to, subject, html, text });
}

export interface ConfirmNotifyDeps {
  issue: typeof issueMagicLink;
  mail: typeof sendConfirmationEmail;
}

const defaultDeps: ConfirmNotifyDeps = {
  issue: issueMagicLink,
  mail: sendConfirmationEmail,
};

/**
 * Run once a deposit is provider-verified (from the webhook confirm path): mint a
 * magic-link token and email the confirmation with that link. Deps are injectable
 * for tests. Never called from the client.
 */
export async function onDepositConfirmed(
  db: Queryable,
  bookingId: string,
  deps: ConfirmNotifyDeps = defaultDeps,
): Promise<{
  emailed: boolean;
  url: string;
  whatsapp?: WhatsAppSendResult;
} | null> {
  const contact = await getBookingContact(db, bookingId);
  if (!contact) return null;
  const raw = await deps.issue(db, bookingId, 90);
  const url = bookingUrl(contact.locale, raw);
  const result = await deps.mail({
    to: contact.email,
    locale: contact.locale,
    reference: contact.reference,
    magicLinkUrl: url,
  });
  // Email is the record + magic-link carrier; WhatsApp confirmation runs in
  // parallel and only actually sends when the businessApi adapter is active.
  // Failure-safe: it never throws, so a verified confirm is never broken.
  const whatsapp = await notifyBookingConfirmed(db, bookingId).catch(
    (e): WhatsAppSendResult => ({
      sent: false,
      error: e instanceof Error ? e.message : String(e),
    }),
  );
  return { emailed: result.sent, url, whatsapp };
}
