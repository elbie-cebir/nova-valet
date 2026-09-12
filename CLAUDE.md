# CLAUDE.md — Nova Valet

Persistent contract for this repo. Read before every step. This file is the source of truth for stack, plan, invariants, and working discipline. Update it only when the human authorizes a change to scope.

## Product

Nova Valet — a **single-tenant** mobile car-valeting booking site. One business, one owner. Customers book a valeting service into an available time slot, pay a deposit, and receive confirmation. **Guest-only**: no customer accounts.

## Stack

- **Framework**: Next.js (App Router) + TypeScript, deployed on **Vercel**.
- **Data + Auth**: **Supabase** (Postgres + Auth). Server and client access via `@supabase/ssr`.
- **Payments**: **multi-provider** — Bancontact → **Mollie**, card/Visa → **Stripe**, routed by the payment method the customer picks. One `PaymentGateway` interface with two adapters (Mollie, Stripe). Both run on **test keys now**; live is a **per-provider key swap, no redeploy**. Never hardcode keys or mode. (ADR-013)
- **Email**: **Resend**.
- **i18n**: **next-intl** with locales `nl` (default), `en`, `fr`. Locale-prefixed routing.
- **WhatsApp**: Owner-tap via `wa.me` links now. A **modular WhatsApp service** exposes ONE interface with two adapters:
  - `manual` adapter — live (generates `wa.me` tap links for the owner).
  - `businessApi` adapter — **base layer only, config-gated**, off by default. WABA approval in process; do not wire it live.
- **No SMS.** Ever.

## Build spine (authorized ONE step at a time — never run ahead)

- **B0** — foundation (scaffold, Supabase wiring, i18n routing, env structure, test runner)
- **B1** — data layer
- **B2** — catalog + availability
- **B3** — booking flow + slot reserve
- **B4** — payments
- **B5** — confirmation + guest lookup
- **B6** — admin
- **B7** — notifications seam + WhatsApp service
- **B8** — guest self-service
- **B9** — polish + validate + deploy

## Core invariants (never violate)

1. **Slot reserve-then-confirm on deposit**: reserving a slot creates a **hold with a TTL**. The booking **confirms only on a provider-verified deposit**; the hold is **released on abandon or expiry**.
2. **No double-booking**: enforced by a DB **uniqueness constraint** plus an **atomic** state transition. Never rely on app-level checks alone.
3. **No confirmation without a provider-verified deposit.** A booking is never `confirmed` unless the payment provider (Mollie or Stripe) has verified the deposit payment.
4. **Flat, non-refundable deposit.**
5. **Free reschedule only before the cutoff.** After the cutoff, no free reschedule.
6. **Guest-only identity**: token identity via **magic link**, plus **reference + contact** as fallback lookup. No passworded customer accounts.
7. **Money truth is the payment provider (Mollie or Stripe).** The local payment table only **mirrors provider events** — it is never the source of truth and is never written ahead of the provider.

## Engineering Standards (merge gate)

`docs/engineering-standards.md` is the **canonical quality bar every change is measured against** — the security bar, the performance bar, and the Definition of Done. Point at that file; do not duplicate its bars here.

The **six non-negotiables (the spine)**, verbatim:
- Parse, don't trust. Every boundary — route handler, server action, payment-provider callback (Stripe webhook / Mollie notify), env var — validates input against a Zod schema before use. A cast is not a parse.
- One source of truth per fact. A shape is defined once (Zod) and derived everywhere. Money truth is the payment provider (Mollie or Stripe); the payment table mirrors provider events only. Config constants live in one module.
- The test fails first. No implementation before a test that fails without it.
- No silent state change. Every booking and slot transition is explicit, attributed where an actor exists, and recorded. No slot moves to booked without a provider-verified deposit.
- Layers don't leak. A route handler holds no business logic; a component holds no data-fetching or SQL; Supabase is reached through a data-access layer, never from a component.
- The machine enforces what it can. Lint, tsconfig, and DB constraints are law; the prose is the reasoning.

The **Definition of Done** in `docs/engineering-standards.md` is the **merge gate run on every B-step** — a change is done only when every box is checked.

Commits are authored solely as the git user, with no AI attribution or co-author trailer of any kind (ADR-012).

The full per-area **playbooks** (coding conventions, how code is written) are authored **after ship** under `docs/playbooks/`. Where a playbook and the standards disagree, the playbook wins on *how* code is written; the standards govern the *quality bar*.

## Working discipline

- **Single-mode execution**: do ONLY the authorized step, then **STOP and report**. Never start the next B-step without explicit authorization.
- **Every step ships with tests.** A test suite is required and must be green before reporting done.
- **No CI/CD tonight.**
- **You own HOW** — implementation choices are yours; the invariants and stack above are not.
- Report format at each stop: what was built, test result, deviations, and what's needed from the human (keys, decisions).

## Environment / conventions

- Secrets live in env vars only; `.env.example` documents every required key. Never commit real secrets.
- Payment mode (test vs live) is controlled purely by which keys are in the environment, per provider (Stripe and Mollie) — no code change, no redeploy.
- Locale routing: `/` → `nl`; `/en`, `/fr` for the others.

## Current state

- **B0 complete.** Next.js App Router + TS scaffold, Supabase server/client helpers, next-intl (nl/en/fr) routing, `.env.example`, Vitest runner.
- **B1 complete.** Postgres schema (migrations in `supabase/migrations`), integer-cents money, `payment` provider/method enums, no-double-booking partial unique index, config constants (`src/config/constants.ts`), placeholder seed. Tested via PGlite.
- **B2 complete.** Catalog + availability read surfaces. Data-access layer in `src/lib/data/` (all functions take a `Queryable`, tested via PGlite): catalog, `getAvailableSlots` (open-only), `getTravelFee`. Services + Prices screens (`/[locale]/services`, `/[locale]/prices`) built to the Novavale POC design (dark/lime, Space Grotesk/Public Sans/JetBrains Mono), server-first (prices tier via `?size=`), price-by-tier from the `price` table, localized nl/en/fr. **B2 reads from a local seeded PGlite instance** (`src/lib/data/db.server.ts`) — swapping to the real Supabase Postgres is a later env-driven step; DAL callers won't change. First parse boundary added (`?size` via Zod).
- **B3 complete.** Multi-step booking flow (`/[locale]/book`) matching the POC: service → size → add-ons → location (postcode → travel fee, out-of-area blocks) → date/time (open slots) → contact, localized nl/en/fr. Client wizard (`src/components/booking/booking-flow.tsx`) over server actions (`book/actions.ts`); every step + reserve payload parsed with Zod; money recomputed server-side (`src/lib/booking/pricing.ts`). **Slot reserve-then-confirm** in `src/lib/data/booking.ts` (`reserveSlot`, `releaseExpiredHolds`): atomic hold (open→held, TTL, booking `pending_deposit`), partial-unique-index backstop, expiry sweep frees lapsed holds. Placeholder handoff at `/book/pending/[reference]` (B4 wires payment). Seed now generates upcoming open slots.
- **B4 complete.** Multi-provider payments (ADR-013). `PaymentGateway` seam (`src/lib/payments/`) with `stripeGateway` (card) + `mollieGateway` (Bancontact), `gatewayFor(method)` routing; signature-verified Stripe webhook + status-fetched Mollie notify (`src/app/api/webhooks/*`). Deposit confirm is the only path that books a slot; idempotent, reuse-open-checkout guard, `refund_due` flagging for duplicate/late captures (no refund hell). Payment table mirrors provider events only (invariant 7).
- **B5 complete.** Confirmation + guest lookup. Hashed/expiring magic-link tokens (`src/lib/data/token.ts`, fail-closed); guest view `/[locale]/booking/[token]` with QR + status-aware payment (deposit→balance→fully-paid, ADR-016); reference+contact fallback `/[locale]/find`; confirmation email via notification seam (`src/lib/notifications/`, Resend when keyed) sent from the webhook confirm path, email failure never breaks confirm.
- **B6 complete.** Owner admin under `/[locale]/admin` (fail-closed: non-owner → 404). Supabase-Auth owner login (`src/lib/auth/owner.ts` `isOwnerEmail`/`requireOwner`, `OWNER_EMAIL` gate, no self-signup); middleware refreshes the session. Bookings list + payment status (paginated), booking detail with payment rows + audit history, real slot management (`src/lib/data/slots.ts` create/open/close with the 1-hour travel buffer, `slot.closed`; feeds `getAvailableSlots`), reschedule/cancel/complete (`src/lib/data/booking.ts`, atomic, attributed to `booking_event`). Owner-tap WhatsApp via the modular `src/lib/whatsapp/` service (manual adapter live, businessApi gated). Requires `OWNER_EMAIL` + a Supabase owner user + the B6 migration applied to Supabase. **UI built to the POC Admin Area** (project `f274fe52…`, `Novavale POC.dc.html`): left sidebar shell (`admin-shell`, customer header hidden on `/admin` via `site-chrome`), bookings dashboard with 4 stat cards + filter chips + WA column, week-grid slot manager (`slot-week-manager`) with bulk create (days × times × range), and a WhatsApp composer (`wa-composer`) with locale-accurate templates. Admin copy is lifted from the POC `novavale-i18n.js`.
- **B7 in progress (activation).** WhatsApp Cloud API activated behind the existing seam. `businessApiAdapter.send()` posts a template message to the Graph API (`graph.facebook.com/{WHATSAPP_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages`), failure-safe (returns a result, never throws). Signature-verified webhook at `/api/webhooks/whatsapp` (`src/lib/whatsapp/signature.ts` X-Hub-256 + `events.ts` parse/dedupe, idempotent). Notification seam (`src/lib/notifications/whatsapp.ts`): confirmation auto-routes through the active adapter on provider-verified deposit (parallel to the Resend email), reminder seam ready; balance/on-my-way stay owner-tap. Real templates (`booking_confirmation/reminder`, `balance_due`, `on_my_way`) are gated behind `WHATSAPP_TEMPLATES_APPROVED`; until approved, sends fall back to Meta `hello_world`. Env: standard Cloud API names + `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. **Paused before the operator's Meta webhook wiring** (set callback URL + verify token, subscribe `messages`); no `hello_world` send until the webhook verifies.
- **B8 complete.** Guest self-service reschedule + cancel on the guest booking view. Token-scoped service (`src/lib/booking/guest.ts` `rescheduleByToken`/`cancelByToken`) resolves the booking id FROM the magic-link token (fail-closed on unknown/other token) and REUSES B6 `rescheduleBooking`/`cancelBooking` — no duplicated logic; before-cutoff, confirmed-only, atomic swap, no new deposit, and attribution (`actor='guest'`) all inherited. Server actions in `booking/[token]/actions.ts`; UI is `GuestActions` on `/[locale]/booking/[token]` (reschedule panel with slot picker + cutoff guard, forfeit-aware cancel), built to the POC guest view/reschedule/cancel-sheet. Copy in the `Manage` namespace (nl/en/fr).
- **B9 in progress (polish + staging deploy).** Polish shipped: WhatsApp `localeToWaLang` emits exactly en/nl/fr + `on_my_way` copy updated to approved wording; **reminder scheduler** — `booking.reminder_sent_at` column, `src/lib/data/reminders.ts` (due-query + atomic claim), `runReminderSweep` (claim-then-send, never double-sends; owner-tap mode no-ops), cron route `/api/cron/reminders` (CRON_SECRET Bearer, fail-closed), `vercel.json` hourly cron. i18n parity verified (260 keys × nl/en/fr). `next build` green; 144 tests pass. **Staging deploy to Vercel is PENDING the human** (Vercel auth + env vars + applying the `reminder_sent_at` migration to Supabase); local `main` is ahead of `origin` (B4–B9 unpushed).
