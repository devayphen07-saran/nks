import {
  pgTable,
  bigint,
  varchar,
  text,
  date,
  boolean,
  check,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../../auth/users';
import { store } from '../../store/store';
import { baseEntity, auditFields } from '../../base.entity';

// Document types enum
export const storeDocumentTypeEnum = pgEnum('store_document_type', [
  'GST_CERT',
  'TRADE_LICENSE',
  'PAN',
  'UDYAM',
  'FOOD_LICENSE',
  'DRUG_LICENSE',
  'SHOP_ACT_LICENSE',
  'FIRE_SAFETY_CERT',
  'OTHER',
]);

export const storeDocuments = pgTable(
  'store_documents',
  {
    ...baseEntity(),

    // Reference to store
    storeFk: bigint('store_fk', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'cascade' }),

    // Type of document
    documentType: storeDocumentTypeEnum('document_type').notNull(),

    // Document number/ID (e.g., GST number, License number)
    documentNumber: varchar('document_number', { length: 100 }).notNull(),

    // URL to document in S3 or storage
    documentUrl: text('document_url'),

    // Expiry date for renewal tracking
    expiryDate: date('expiry_date'),

    // Verification status
    isVerified: boolean('is_verified').notNull().default(false),

    // Uploaded/submitted date
    uploadedDate: timestamp('uploaded_date', { withTimezone: true })
      .notNull()
      .defaultNow(),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Index for quick lookup by store
    index('store_documents_store_idx').on(table.storeFk),
    // Index for document type queries
    index('store_documents_type_idx').on(table.documentType),
    // Index for expiry date tracking (upcoming renewals)
    index('store_documents_expiry_idx').on(table.expiryDate),
    check(
      'store_documents_verified_requires_url',
      sql`NOT (is_verified = true AND document_url IS NULL)`,
    ),
  ],
);

export type StoreDocuments = typeof storeDocuments.$inferSelect;
export type NewStoreDocuments = typeof storeDocuments.$inferInsert;
export type UpdateStoreDocuments = Partial<Omit<NewStoreDocuments, 'id'>>;
