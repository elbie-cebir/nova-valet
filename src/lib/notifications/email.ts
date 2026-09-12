/**
 * Email seam. One `sendEmail`; Resend when `RESEND_API_KEY` is set, otherwise a
 * dev log so the flow works before the key lands (email flips on when it does).
 * SDK-free (Resend REST via fetch), key confined here.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  sent: boolean;
  id?: string;
  loggedOnly?: boolean;
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ?? 'Nova Valet <onboarding@resend.dev>';

  if (!key) {
    console.log(
      `[email:dev] to=${msg.to} subject="${msg.subject}" (RESEND_API_KEY unset — logged only)`,
    );
    return { sent: false, loggedOnly: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
  });
  if (!res.ok) {
    console.error(`[email] Resend ${res.status}: ${await res.text()}`);
    return { sent: false };
  }
  const data = (await res.json()) as { id?: string };
  return { sent: true, id: data.id };
}
