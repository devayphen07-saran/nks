import {
  pgTable,
  varchar,
  numeric,
  integer,
  bigint,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Unit of Measure (UOM) registry for product inventory.
 *
 * STATUS: Schema-ready, business logic NOT yet implemented.
 *
 * Purpose: Defines measurable units used when creating products
 * (e.g. Kilogram, Litre, Piece, Metre). Supports conversion between
 * units via a self-referential `baseVolumeFk` + `conversionFactor`.
 *
 * Planned consumers:
 *   - Products module (product.volumeFk → volumes.id)
 *   - POS / order line items (quantity in this unit)
 *   - Stock adjustments
 *
 * ⚠ DO NOT CONSOLIDATE INTO `lookup` TABLE.
 * Reason: This is the most structurally distinct of the lookup-like tables.
 *   - `base_volume_fk` is a SELF-REFERENTIAL FK for unit conversion (kg ↔ g)
 *   - `conversion_factor NUMERIC(18,6)` carries 6-digit precision math
 *   - `volume_type` and `decimal_places` drive product / inventory rounding
 *   - 2 CHECK constraints prevent corrupt conversion graphs
 *   None of this can be represented in the generic (code, label, description)
 *   shape of `lookup`.
 * Registered in `lookup_type` with has_table=true for catalog discoverability.
 * Confirmed against Ayphen reference (2026-04-30): Volume is also kept
 *   dedicated there with conversion_factor as a business column.
 */
export const volumes = pgTable(
  'volumes',
  {
    ...baseEntity(),

    volumeName: varchar('volume_name', { length: 50 }).notNull().unique(), // Kilogram, Litre, Piece
    volumeCode: varchar('volume_code', { length: 20 }).notNull().unique(), // KG, L, PCS
    volumeType: varchar('volume_type', { length: 50 }).notNull(),
    decimalPlaces: integer('decimal_places').notNull().default(0),

    // Conversion to base unit.
    // baseVolumeFk and conversionFactor must be set together or not at all.
    baseVolumeFk: bigint('base_volume_fk', { mode: 'number' }).references(
      (): AnyPgColumn => volumes.id,
      { onDelete: 'restrict' },
    ),
    conversionFactor: numeric('conversion_factor', { precision: 18, scale: 6 }),

    ...auditFields(() => users.id),
  },
  () => [
    // baseVolumeFk and conversionFactor must both be set or both be NULL.
    // Avoids: FK set with no factor (divide by null) or factor set with no base to convert to.
    check(
      'volumes_conversion_both_or_neither_chk',
      sql`(base_volume_fk IS NULL) = (conversion_factor IS NULL)`,
    ),

    // A unit cannot be its own base — prevents infinite recursion in conversion queries.
    check(
      'volumes_no_self_reference_chk',
      sql`base_volume_fk IS NULL OR base_volume_fk <> id`,
    ),
  ],
);

export type Volume = typeof volumes.$inferSelect;
export type NewVolume = typeof volumes.$inferInsert;
export type UpdateVolume = Partial<Omit<NewVolume, 'id'>>;
export type PublicVolume = Omit<
  Volume,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
