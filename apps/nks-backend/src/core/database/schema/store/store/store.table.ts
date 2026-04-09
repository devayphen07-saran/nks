import {
  pgTable,
  varchar,
  bigint,
  boolean,
  smallint,
  numeric,
  text,
  check,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { users } from '../../auth/users';
import { country } from '../../location/country';
import { storeLegalType } from '../../lookups/store-legal-type/store-legal-type.table';
import { storeCategory } from '../../lookups/store-category/store-category.table';
import { storeStatusEnum } from '../../enums';
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
    // NORMALIZED: Dedicated table instead of code_value pattern
    storeLegalTypeFk: bigint('store_legal_type_fk', { mode: 'number' })
      .notNull()
      .references(() => storeLegalType.id, { onDelete: 'restrict' }),

    // Store category (GROCERY, PHARMACY, RETAIL, RESTAURANT, ECOMMERCE, etc.)
    // NORMALIZED: Dedicated table instead of code_value pattern
    storeCategoryFk: bigint('store_category_fk', { mode: 'number' })
      .notNull()
      .references(() => storeCategory.id, { onDelete: 'restrict' }),

    // ── KYC / Legal ──────────────────────────────────────────────────────────
    registrationNumber: varchar('registration_number', { length: 100 }),
    taxNumber: varchar('tax_number', { length: 100 }), // GST/VAT
    kycLevel: smallint('kyc_level').notNull().default(0),
    isVerified: boolean('is_verified').notNull().default(false),

    // ── Lifecycle ────────────────────────────────────────────────────────────
    // Single source of truth — replaces the ambiguous inherited isActive for stores.
    storeStatus: storeStatusEnum('store_status').notNull().default('ACTIVE'),

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
    // isActive must always match storeStatus — prevents split-brain lifecycle state.
    // Do not set isActive directly; update storeStatus instead and let this rule enforce consistency.
    check(
      'store_status_active_sync_chk',
      sql`(store_status = 'ACTIVE') = is_active`,
    ),
    index('store_owner_user_idx').on(table.ownerUserFk),
    index('store_parent_store_idx').on(table.parentStoreFk), // ← ADDED: for hierarchy queries
  ],
);

export type Store = typeof store.$inferSelect;
export type NewStore = typeof store.$inferInsert;
export type UpdateStore = Partial<Omit<NewStore, 'id'>>;
export type PublicStore = Omit<
  Store,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
