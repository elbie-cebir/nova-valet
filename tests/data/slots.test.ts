import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb } from '../db/db';
import { createSlot, setSlotClosed, listSlots } from '@/lib/data/slots';
import { getAvailableSlots } from '@/lib/data/availability';

const RANGE = { from: '2026-11-01T00:00:00Z', to: '2026-12-01T00:00:00Z' };

describe('owner slot management (create / open / close) [ADR-015 buffer]', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('creates a 2-hour slot that immediately appears in customer availability', async () => {
    const res = await createSlot(db, { startAt: '2026-11-10T09:00:00Z' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // End is derived (2h), never trusted from the caller.
    expect(res.endAt).toBe('2026-11-10T11:00:00.000Z');

    const open = await getAvailableSlots(db, RANGE);
    expect(open.map((s) => s.id)).toContain(res.slotId);
  });

  it('rejects a slot that violates the 1-hour travel buffer', async () => {
    await createSlot(db, { startAt: '2026-11-10T09:00:00Z' }); // 09–11
    const tooClose = await createSlot(db, { startAt: '2026-11-10T11:30:00Z' });
    expect(tooClose).toEqual({ ok: false, reason: 'overlap' });
  });

  it('allows a slot exactly one buffer after the previous one ends', async () => {
    await createSlot(db, { startAt: '2026-11-10T09:00:00Z' }); // 09–11
    // 11:00 end + 1h buffer = 12:00 start — the tightest legal slot.
    const ok = await createSlot(db, { startAt: '2026-11-10T12:00:00Z' });
    expect(ok.ok).toBe(true);
  });

  it('closing a slot removes it from availability; re-opening restores it', async () => {
    const res = await createSlot(db, { startAt: '2026-11-10T09:00:00Z' });
    if (!res.ok) throw new Error('setup');

    expect(await setSlotClosed(db, res.slotId, true)).toEqual({ ok: true });
    let open = await getAvailableSlots(db, RANGE);
    expect(open.map((s) => s.id)).not.toContain(res.slotId);

    const listed = await listSlots(db, RANGE);
    expect(listed.find((s) => s.id === res.slotId)?.closed).toBe(true);

    expect(await setSlotClosed(db, res.slotId, false)).toEqual({ ok: true });
    open = await getAvailableSlots(db, RANGE);
    expect(open.map((s) => s.id)).toContain(res.slotId);
  });

  it('will not close a slot that is already held or booked', async () => {
    const {
      rows: [slot],
    } = await db.query<{ id: string }>(
      `insert into slot (start_at, end_at, status)
       values ('2026-11-15T09:00:00Z','2026-11-15T11:00:00Z','booked') returning id`,
    );
    expect(await setSlotClosed(db, slot.id, true)).toEqual({
      ok: false,
      reason: 'in_use',
    });
  });
});
