import { describe, it, expect } from 'vitest';
import {
  DEPOSIT_AMOUNT_CENTS,
  SLOT_LENGTH_HOURS,
  RESCHEDULE_CUTOFF_HOURS,
  REMINDER_LEAD_HOURS,
  HOLD_TTL_MINUTES,
} from '@/config/constants';

describe('config constants (one source of truth)', () => {
  it('holds the B1 placeholder values', () => {
    expect(DEPOSIT_AMOUNT_CENTS).toBe(2500);
    expect(SLOT_LENGTH_HOURS).toBe(2);
    expect(RESCHEDULE_CUTOFF_HOURS).toBe(24);
    expect(REMINDER_LEAD_HOURS).toBe(24);
    expect(HOLD_TTL_MINUTES).toBe(15);
  });
});
