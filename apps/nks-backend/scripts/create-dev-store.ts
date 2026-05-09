/**
 * Dev script — inserts a single store owned by a specific user.
 *
 * Usage:
 *   npx tsx scripts/create-dev-store.ts
 *
 * Resolves foreign keys at runtime so it can run against any DB that has
 * been seeded (lookup_types, business_statuses).
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import * as schema from '../src/core/database/schema';
const { users, lookup, lookupType, status, store } = schema;

const OWNER_GUUID = 'f36bccaa-156c-453e-bde7-2f7f8fe5fd90';

const STORE = {
  storeName:  'Ayphen Dev Store',
  storeCode:  'AYPHEN-001',
  timezone:   'Asia/Kolkata',
  defaultTaxRate: '18.00',
  legalTypeCode:  'SOLE_PROP',
  categoryCode:   'GENERAL_STORE',
  statusCode:     'ACTIVE',
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function run() {
  // 1. Resolve owner user
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.guuid, OWNER_GUUID))
    .limit(1);

  if (!owner) {
    throw new Error(`User with guuid ${OWNER_GUUID} not found — check DB or re-register the user.`);
  }

  // 2. Resolve store_legal_type FK
  const [legalTypeRow] = await db
    .select({ id: lookupType.id })
    .from(lookupType)
    .where(eq(lookupType.code, 'STORE_LEGAL_TYPE'))
    .limit(1);
  if (!legalTypeRow) throw new Error('lookup_type STORE_LEGAL_TYPE not found — run db:seed first.');

  const [legalType] = await db
    .select({ id: lookup.id })
    .from(lookup)
    .where(eq(lookup.code, STORE.legalTypeCode))
    .limit(1);
  if (!legalType) throw new Error(`Lookup ${STORE.legalTypeCode} not found — run db:seed first.`);

  // 3. Resolve store_category FK
  const [category] = await db
    .select({ id: lookup.id })
    .from(lookup)
    .where(eq(lookup.code, STORE.categoryCode))
    .limit(1);
  if (!category) throw new Error(`Lookup ${STORE.categoryCode} not found — run db:seed first.`);

  // 4. Resolve status FK
  const [activeStatus] = await db
    .select({ id: status.id })
    .from(status)
    .where(eq(status.code, STORE.statusCode))
    .limit(1);
  if (!activeStatus) throw new Error(`Status ${STORE.statusCode} not found — run db:seed first.`);

  // 5. Insert store
  const [created] = await db
    .insert(store)
    .values({
      storeName:        STORE.storeName,
      storeCode:        STORE.storeCode,
      timezone:         STORE.timezone,
      defaultTaxRate:   STORE.defaultTaxRate,
      ownerUserFk:      owner.id,
      storeLegalTypeFk: legalType.id,
      storeCategoryFk:  category.id,
      statusFk:         activeStatus.id,
      isActive:         true,
      createdBy:        owner.id,
    })
    .returning();

  console.log('\nStore created:');
  console.log(`  id:        ${created.id}`);
  console.log(`  guuid:     ${created.guuid}`);
  console.log(`  name:      ${created.storeName}`);
  console.log(`  code:      ${created.storeCode}`);
  console.log(`  owner:     user.id=${owner.id} (guuid=${OWNER_GUUID})`);
  console.log(`  legal:     ${STORE.legalTypeCode} (id=${legalType.id})`);
  console.log(`  category:  ${STORE.categoryCode} (id=${category.id})`);
  console.log(`  status:    ${STORE.statusCode} (id=${activeStatus.id})`);
}

run()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
