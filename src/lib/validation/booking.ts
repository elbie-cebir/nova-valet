import { z } from 'zod';
import { VEHICLE_SIZES } from './params';

/**
 * Booking-flow input schemas. Every step parses before use (parse, don't
 * trust): the client wizard validates for UX, and the server actions re-parse
 * the same shapes before any DB write — the server never trusts the client.
 *
 * IDs are validated as UUIDs here; their existence is enforced by DB foreign
 * keys at reserve time. Money is never taken from the client — amounts are
 * looked up server-side from the price/add-on tables.
 */

const uuid = z.uuid();

/** Step 1 — service. */
export const serviceStepSchema = z.object({
  serviceId: uuid,
});

/** Step 2 — vehicle size tier. */
export const sizeStepSchema = z.object({
  size: z.enum(VEHICLE_SIZES),
});

/** Step 3 — add-ons (optional; may be empty). */
export const addOnsStepSchema = z.object({
  addOnIds: z.array(uuid).default([]),
});

/** Step 4 — location. Postcode is a Belgian-style 4+ digit code (placeholder rule). */
export const locationStepSchema = z.object({
  address: z.string().trim().min(3),
  postcode: z
    .string()
    .trim()
    .regex(/^\d{4,}$/),
  notes: z.string().trim().max(500).optional().default(''),
});

/** Step 5 — chosen slot. */
export const slotStepSchema = z.object({
  slotId: uuid,
});

/** Step 6 — contact details. */
export const contactStepSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(6),
  email: z.email(),
  agree: z.literal(true),
});

/**
 * The full reserve payload the server action re-parses before holding a slot.
 * This is the union of every step — nothing reaches the DB unparsed.
 */
export const reserveInputSchema = z.object({
  ...serviceStepSchema.shape,
  ...sizeStepSchema.shape,
  ...addOnsStepSchema.shape,
  ...locationStepSchema.shape,
  ...slotStepSchema.shape,
  ...contactStepSchema.shape,
  locale: z.enum(['nl', 'en', 'fr']).optional(),
});

export type ReserveInput = z.infer<typeof reserveInputSchema>;
export type LocationStep = z.infer<typeof locationStepSchema>;
export type ContactStep = z.infer<typeof contactStepSchema>;
