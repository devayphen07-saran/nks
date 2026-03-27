/**
 * NKS Database Seed — Orchestrator (Simplified)
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/core/database/schema';

import {
  seedSalutations,
  seedCountries,
  seedStates,
  seedDistricts,
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
} from './seeds';

const INIT = process.env.INIT === 'true';
if (!INIT) {
  console.log('⏭️  Skipping seed — set INIT=true to seed initial data.');
  process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const seeds = [
  { name: 'salutation',              fn: seedSalutations },
  { name: 'country',                 fn: seedCountries },
  { name: 'state',                   fn: seedStates },
  { name: 'district',                fn: seedDistricts },
  { name: 'pincode',                 fn: seedPincodes },
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
];

async function seed() {
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
