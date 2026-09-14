import { describe, it, expect } from 'vitest';
import { bookingDisplay } from '@/lib/booking/display';

const FUTURE = '2099-01-01T10:00:00Z';
const PAST = '2000-01-01T10:00:00Z';
const NOW = Date.parse('2050-01-01T00:00:00Z');
const base = { depositPaidAt: null, balancePaidAt: null, balanceCents: 500 };

describe('bookingDisplay', () => {
  it('pending deposit', () => {
    const d = bookingDisplay(
      { ...base, status: 'pending_deposit', slotStartAt: FUTURE },
      NOW,
    );
    expect(d.statusKey).toBe('pending_deposit');
    expect(d.fullyPaid).toBe(false);
    expect(d.completed).toBe(false);
  });

  it('confirmed, upcoming, balance still due → confirmed', () => {
    const d = bookingDisplay(
      {
        status: 'confirmed',
        slotStartAt: FUTURE,
        depositPaidAt: 'x',
        balancePaidAt: null,
        balanceCents: 500,
      },
      NOW,
    );
    expect(d.statusKey).toBe('confirmed');
    expect(d.fullyPaid).toBe(false);
    expect(d.isPast).toBe(false);
  });

  it('confirmed, upcoming, balance paid → fully_paid', () => {
    const d = bookingDisplay(
      {
        status: 'confirmed',
        slotStartAt: FUTURE,
        depositPaidAt: 'x',
        balancePaidAt: 'y',
        balanceCents: 500,
      },
      NOW,
    );
    expect(d.statusKey).toBe('fully_paid');
    expect(d.fullyPaid).toBe(true);
    expect(d.completed).toBe(false);
  });

  it('confirmed with zero balance + deposit paid → fully_paid', () => {
    const d = bookingDisplay(
      {
        status: 'confirmed',
        slotStartAt: FUTURE,
        depositPaidAt: 'x',
        balancePaidAt: null,
        balanceCents: 0,
      },
      NOW,
    );
    expect(d.fullyPaid).toBe(true);
  });

  it('confirmed but slot passed → completed', () => {
    const d = bookingDisplay(
      {
        status: 'confirmed',
        slotStartAt: PAST,
        depositPaidAt: 'x',
        balancePaidAt: 'y',
        balanceCents: 500,
      },
      NOW,
    );
    expect(d.statusKey).toBe('completed');
    expect(d.completed).toBe(true);
    expect(d.isPast).toBe(true);
  });

  it('completed status → completed', () => {
    const d = bookingDisplay(
      { ...base, status: 'completed', slotStartAt: FUTURE },
      NOW,
    );
    expect(d.statusKey).toBe('completed');
  });

  it('cancelled / expired → dead, keep their own label', () => {
    expect(
      bookingDisplay({ ...base, status: 'cancelled', slotStartAt: FUTURE }, NOW)
        .statusKey,
    ).toBe('cancelled');
    expect(
      bookingDisplay({ ...base, status: 'expired', slotStartAt: FUTURE }, NOW)
        .dead,
    ).toBe(true);
  });
});
