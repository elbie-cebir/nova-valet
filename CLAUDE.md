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

1. **Slot reserve-then-confirm on deposit**: reserving a slot creates a **hold with a TTL**. The booking **confirms only on Stripe success**; the hold is **released on abandon or expiry**.
2. **No double-booking**: enforced by a DB **uniqueness constraint** plus an **atomic** state transition. Never rely on app-level checks alone.
3. **No confirmation without a Stripe-verified deposit.** A booking is never `confirmed` unless Stripe has verified the deposit payment.
4. **Flat, non-refundable deposit.**
5. **Free reschedule only before the cutoff.** After the cutoff, no free reschedule.
6. **Guest-only identity**: token identity via **magic link**, plus **reference + contact** as fallback lookup. No passworded customer accounts.
7. **Money truth is Stripe.** The local payment table only **mirrors webhooks** — it is never the source of truth and is never written ahead of Stripe.

## Engineering Standards (merge gate)

`docs/engineering-standards.md` is the **canonical quality bar every change is measured against** — the security bar, the performance bar, and the Definition of Done. Point at that file; do not duplicate its bars here.

The **six non-negotiables (the spine)**, verbatim:
- Parse, don't trust. Every boundary — route handler, server action, Stripe webhook, env var — validates input against a Zod schema before use. A cast is not a parse.
- One source of truth per fact. A shape is defined once (Zod) and derived everywhere. Money truth is Stripe; the payment table mirrors webhooks only. Config constants live in one module.
- The test fails first. No implementation before a test that fails without it.
- No silent state change. Every booking and slot transition is explicit, attributed where an actor exists, and recorded. No slot moves to booked without a Stripe-verified deposit.
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
- Stripe mode (test vs production) is controlled purely by which keys are in the environment — no code change, no redeploy.
- Locale routing: `/` → `nl`; `/en`, `/fr` for the others.

## Current state

- **B0 complete.** Next.js App Router + TS scaffold, Supabase server/client helpers, next-intl (nl/en/fr) routing, `.env.example`, Vitest runner. Nothing from B1+ started.
