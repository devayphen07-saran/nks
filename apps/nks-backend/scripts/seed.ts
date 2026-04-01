/**
 * NKS Database Seed — Orchestrator (Simplified)
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/core/database/schema';
import fs from 'fs';
import path from 'path';

import {
  seedSalutations,
  seedCountries,
  seedStates,
  seedAdministrativeDivisions,
  seedPincodes,
  seedAddressTypes,
  seedCommunicationTypes,
  seedNotesTypes,
  seedContactPersonTypes,
  seedDesignations,
  seedStoreLegalTypes,
  seedStoreCategories,
  seedVolumes,
  seedEntities,
  seedRoles,
  seedPermissions,
  seedRoutes,
  seedRolePermissionMappings,
  seedRoleRouteMappings,
  seedTaxAgencies,
  seedTaxNames,
  seedTaxLevels,
  seedTaxLevelMappings,
  seedCommodityCodes,
  seedTaxRateMaster,
} from './seeds';

const INIT = process.env.INIT === 'true';
if (!INIT) {
  console.log('⏭️  Skipping seed — set INIT=true to seed initial data.');
  process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

/**
 * Run SQL migrations from the migrations directory
 */
async function runMigrations(client: any) {
  const migrationsDir = path.join(__dirname, '..', 'src', 'core', 'database', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    return;
  }

  console.log('🔄 Running database migrations...\n');

  for (const fileName of migrationFiles) {
    const filePath = path.join(migrationsDir, fileName);
    try {
      const sql = fs.readFileSync(filePath, 'utf-8');
      await client.query(sql);
      console.log(`  ✅ ${fileName}`);
    } catch (err: any) {
      // Skip "already exists" errors
      if (err.message.includes('already exists') || err.code === '42P07' || err.code === '42701') {
        console.log(`  ⏭️  ${fileName} (already applied)`);
      } else {
        console.warn(`  ⚠️  ${fileName}: ${err.message}`);
      }
    }
  }

  console.log();
}

const seeds = [
  { name: 'salutation',              fn: seedSalutations },
  { name: 'country',                 fn: seedCountries },
  { name: 'state',                   fn: seedStates },
  { name: 'administrative_division', fn: seedAdministrativeDivisions },
  { name: 'postal_code',             fn: seedPincodes },
  { name: 'address_type',            fn: seedAddressTypes },
  { name: 'communication_type',      fn: seedCommunicationTypes },
  { name: 'notes_type',              fn: seedNotesTypes },
  { name: 'contact_person_type',     fn: seedContactPersonTypes },
  { name: 'designation',             fn: seedDesignations },
  { name: 'store_legal_type',        fn: seedStoreLegalTypes },
  { name: 'store_category',          fn: seedStoreCategories },
  { name: 'volumes',                 fn: seedVolumes },
  { name: 'entity',                  fn: seedEntities },
  { name: 'roles',                   fn: seedRoles },
  { name: 'permissions',             fn: seedPermissions },
  { name: 'routes',                  fn: seedRoutes },
  { name: 'role_permission_mapping', fn: seedRolePermissionMappings },
  { name: 'role_route_mapping',      fn: seedRoleRouteMappings },      // ← SUPER_ADMIN admin routes
  // Tax Engine (runs after country — tax_agencies references country)
  { name: 'tax_agencies',            fn: seedTaxAgencies },
  { name: 'tax_names',               fn: seedTaxNames },
  { name: 'tax_levels',              fn: seedTaxLevels },
  { name: 'tax_level_mapping',       fn: seedTaxLevelMappings },
  // Tax Master Data (commodity codes and rates for multi-country support)
  { name: 'commodity_codes',         fn: seedCommodityCodes },
  { name: 'tax_rate_master',         fn: seedTaxRateMaster },
];

async function seed() {
  const client = await pool.connect();

  // Run migrations first
  await runMigrations(client);

  client.release();

  console.log('🌱 Starting simplified seed...\n');
  let success = 0;
  let failed = 0;

  for (const { name, fn } of seeds) {
    try {
      const result = await fn(db);
      const inserted = result.rowCount ?? 0;
      console.log(`  ✅ ${name}: ${inserted} inserted`);
      success++;
    } catch (err: any) {
      console.error(`  ❌ ${name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${failed === 0 ? '✅' : '⚠️'}  Seed complete — ${success} succeeded, ${failed} failed`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
}).finally(() => pool.end());
