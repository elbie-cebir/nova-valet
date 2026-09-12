import { z } from 'zod';

/**
 * The vehicle-size tier selected on the prices screen, read from the `?size=`
 * search param. This is a request boundary, so it is parsed, not trusted:
 * an unknown or missing value falls back to a safe default rather than being
 * passed to a query. (Standards: "Parse, don't trust.")
 */
export const VEHICLE_SIZES = ['small', 'medium', 'large', 'van'] as const;
export type VehicleSize = (typeof VEHICLE_SIZES)[number];

export const DEFAULT_VEHICLE_SIZE: VehicleSize = 'medium';

const sizeSchema = z.enum(VEHICLE_SIZES).catch(DEFAULT_VEHICLE_SIZE);

/** Parse an untrusted `size` value into a known tier, defaulting safely. */
export function parseVehicleSize(input: unknown): VehicleSize {
  return sizeSchema.parse(input);
}
