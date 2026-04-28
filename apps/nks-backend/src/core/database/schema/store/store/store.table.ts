import {
  pgTable,
  varchar,
  bigint,
  boolean,
  smallint,
  numeric,
  text,
  index,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { users } from '../../auth/users';
import { country } from '../../location/country';
import { lookup } from '../../lookups/lookup/lookup.table';
import { status } from '../../entity-system/status';
import { baseEntity, auditFields } from '../../base.entity';

export const store = pgTable(
  'store',
  {
    ...baseEntity(),

    // IAM Store ID — opaque identifier for external system integration
    iamStoreId: varchar('iam_store_id', { length: 64 }).unique(),

    storeName: varchar('store_name', { length: 255 }).notNull(),
    storeCode: varchar('store_code', { length: 50 }).unique(),

    // ── OWNERSHIP ─────────────────────────────────────────────────────────────
    // Store owner: the root user with full access to the store
    // This is NOT a role, but a direct user-store relationship
    // Owner user can be changed via this field; replaces the old STORE_OWNER role concept
    ownerUserFk: bigint('owner_user_fk', { mode: 'number' })
      .references(() => users.id, {
        onDelete: 'restrict', // ← FIXED: prevent loss of store ownership audit trail
      }),

    // Legal entity type (PVT_LTD, SOLE_PROP, PARTNERSHIP, LLC, CORP, TRUST, OPC, SOCIETY, etc.)
    storeLegalTypeFk: bigint('store_legal_type_fk', { mode: 'number' })
      .notNull()
      .references(() => lookup.id, { onDelete: 'restrict' }),

    // Store category (GROCERY, PHARMACY, RETAIL, RESTAURANT, ECOMMERCE, etc.)
    storeCategoryFk: bigint('store_category_fk', { mode: 'number' })
      .notNull()
      .references(() => lookup.id, { onDelete: 'restrict' }),

    // ── KYC / Legal ──────────────────────────────────────────────────────────
    // tax_number removed — tax registrations (GST/PAN/VAT) live in tax_registrations table
    registrationNumber: varchar('registration_number', { length: 100 }),
    kycLevel: smallint('kyc_level').notNull().default(0),
    isVerified: boolean('is_verified').notNull().default(false),

    // ── Lifecycle ────────────────────────────────────────────────────────────
    // FK to status reference table — replaces the storeStatusEnum.
    // Valid store statuses: DRAFT, ACTIVE, INACTIVE, SUSPENDED, VERIFIED, ARCHIVED, CLOSED.
    // isActive must be kept in sync at the service layer when status changes.
    statusFk: bigint('status_fk', { mode: 'number' })
      .notNull()
      .references(() => status.id, { onDelete: 'restrict' }),

    // ── POS Operational ──────────────────────────────────────────────────────
    // countryFk — link to country for currency and timezone defaults.
    // Drives price display, receipt formatting, and rounding rules.
    countryFk: bigint('country_fk', { mode: 'number' }).references(
      () => country.id,
      { onDelete: 'restrict' },
    ),

    // timezone — IANA timezone string (e.g. 'Asia/Kolkata', 'America/New_York').
    // Required for: daily report boundaries, shift calculations, scheduled jobs.
    timezone: varchar('timezone', { length: 60 }).notNull().default('UTC'),

    // defaultTaxRate — store-level fallback tax % applied to products that have no
    // product-specific tax rule. Stored as decimal (e.g. 18.00 = 18%).
    defaultTaxRate: numeric('default_tax_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0'),

    // logoUrl — displayed in app header, receipts, and staff invite emails.
    logoUrl: text('logo_url'),

    // ── Hierarchy ────────────────────────────────────────────────────────────
    parentStoreFk: bigint('parent_store_fk', { mode: 'number' }).references(
      (): AnyPgColumn => store.id,
      { onDelete: 'restrict' },
    ),

    ...auditFields(() => users.id),
  },
  (table) => [
    index('store_owner_user_idx').on(table.ownerUserFk),
    index('store_parent_store_idx').on(table.parentStoreFk),
    index('store_status_fk_idx').on(table.statusFk),
  ],
);

export type Store = typeof store.$inferSelect;
export type NewStore = typeof store.$inferInsert;
export type UpdateStore = Partial<Omit<NewStore, 'id'>>;
export type PublicStore = Omit<
  Store,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
