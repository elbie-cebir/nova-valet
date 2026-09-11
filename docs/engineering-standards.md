# Novabiz Valet — Engineering Standards

Canonical source for the security bar, the performance bar, and the Definition of Done. It does not restate coding conventions — those are the Playbooks (docs/playbooks/, authored after ship). Where a playbook and this doc disagree, the playbook wins on how code is written; this doc governs the quality bar a change is measured against.

Stack: Next.js (App Router) + TypeScript on Vercel; Supabase (Postgres + Auth); payments via Mollie (Bancontact) and Stripe (card); Resend; next-intl. Single-tenant, guest-only customers, owner admin.

## The non-negotiables (the spine)
- Parse, don't trust. Every boundary — route handler, server action, payment-provider callback (Stripe webhook / Mollie notify), env var — validates input against a Zod schema before use. A cast is not a parse.
- One source of truth per fact. A shape is defined once (Zod) and derived everywhere. Money truth is the payment provider (Mollie or Stripe); the payment table mirrors provider events only. Config constants live in one module.
- The test fails first. No implementation before a test that fails without it.
- No silent state change. Every booking and slot transition is explicit, attributed where an actor exists, and recorded. No slot moves to booked without a provider-verified deposit.
- Layers don't leak. A route handler holds no business logic; a component holds no data-fetching or SQL; Supabase is reached through a data-access layer, never from a component.
- The machine enforces what it can. Lint, tsconfig, and DB constraints are law; the prose is the reasoning.

## Security bar
- [ ] Authorization on every state-changing route. Owner-only admin actions check the authenticated owner (Supabase Auth); guest actions are scoped to a single booking by an unguessable token. No mutation without the check.
- [ ] Guest access is token-scoped and fails closed. A booking is reachable only via its magic-link/QR token or reference+contact; a missing or mismatched token returns not-found, never an existence leak or another booking.
- [ ] Every boundary parses before use. Route handlers, server actions, the payment-provider callback (Stripe webhook / Mollie notify), and env/config go through schema.parse(); failures map to a stable error envelope, never a raw ZodError.
- [ ] Payment truth comes from the provider, never the client: Mollie via a status fetch on notify, Stripe via a signature-verified webhook. Neither the client nor a raw webhook body is trusted. The client never confirms a booking; only a provider-verified payment moves a slot to booked or marks the balance paid.
- [ ] Secrets server-side only. Stripe secret key, Mollie API key, Supabase service-role key, and Resend key never reach the client bundle, logs, or git. .env* is git-ignored; .env.example documents what is needed. Sandbox to prod is an env swap.
- [ ] Customer PII is minimized and never logged. Logs and errors carry a booking id or reference, never customer name, email, or phone. Responses leak no PII beyond the guest's own booking.
- [ ] Errors leak no internals. No stack traces or SQL to the client; a stable error code plus a safe message plus a correlation id. A swallowing catch(e){} is banned.
- [ ] Sensitive actions are recorded. Cancellations (deposit forfeited), reschedules, and admin changes are attributed and timestamped.
- [ ] Tokens are unguessable and expiring. Magic-link and QR tokens are high-entropy, hashed at rest, and expire.

## Performance bar (directional, not an SLA)
- [ ] No N+1. A loop with an await query inside it is a defect. Availability and admin lists load batched or joined.
- [ ] Queries hit indexes on the columns they filter or join on (slot times, booking reference, tokens, postcode).
- [ ] List and read endpoints are paginated; no unbounded result sets.
- [ ] Derived values are computed on read, not stored (availability from slots). Only the booking's locked figures are stored.
- [ ] Frontend server-first (RSC). "use client" is opt-in, justified, and pushed to the leaves. Stable keys, never array index. Memoize only when measured.
- [ ] Directional target: p95 < 300 ms for local reads. A bar to tune as real numbers arrive.

## Definition of Done (the merge gate)
A change is done only when every box is checked. Run this list as the gate on every B-step.
- [ ] A failing test existed before the implementation (red → green → refactor), failing for the right reason.
- [ ] Affected tests pass; the load-bearing domain has named tests: slot reserve-then-confirm, no-double-booking, deposit-then-confirm, non-refundable cancel, guest-token scoping.
- [ ] Conforms to the relevant playbook(s); lint, typecheck, and Prettier are clean.
- [ ] Meets the security bar and the performance bar above.
- [ ] Each Spec invariant it implements has a named test citing the invariant.
- [ ] No secrets in the diff; a conventional commit (feat/fix/refactor/test/chore:) that references the Roadmap step (B0-B9) or an ADR.
- [ ] Commit authored solely as the git user; no AI attribution, no Co-Authored-By trailer, no "Generated with" line.
- [ ] In-repo docs are current: if the change alters build status, the data model, run steps, or architecture, README and the relevant docs update in the same change, and CLAUDE.md stays current.
- [ ] Reviewed against the relevant playbook checklist(s).

## The two tone-setting tests
The first two tests in the repo, the domain's load-bearing guarantees:
- "two customers cannot book the same slot" (uniqueness constraint + reserve-then-confirm).
- "a booking is not confirmed without a provider-verified deposit" (provider-truth: Mollie status fetch / Stripe webhook).

_Amend this doc with a conventional commit when a bar changes. Do not fork these definitions elsewhere — this is their one source of truth._
