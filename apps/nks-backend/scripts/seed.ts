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
  seedCountries,
  seedStateTable,
  seedDistrictTable,
  seedPincodeTable,
  seedCommunicationTypes,
  seedNotesTypes,
  seedContactPersonTypes,
  seedVolumes,
  seedEntities,
  seedSystemRoles,
  seedRoutes,
  seedRoleRouteMappings,
  seedTaxAgencies,
  seedTaxNames,
  seedTaxLevels,
  seedTaxLevelMappings,
  seedCommodityCodes,
  seedTaxRateMaster,
  // Subscription System
  seedCurrencies,
  seedSubscriptionStatus,
  // New Lookup Tables
  seedStoreLegalTypes,
  seedStoreCategories,
  seedAddressTypes,
  seedSalutationTypes,
  seedDesignationTypes,
  seedBillingFrequencies,
  seedNotificationStatuses,
  seedStaffInviteStatuses,
  seedTaxRegistrationTypes,
  seedTaxFilingFrequencies,
  seedPlanTypes,
  seedTaxLineStatuses,
  seedEntityTypes,
  seedPermissionActions,
  seedSuperAdminPermissions,
} from './seeds';

const INIT = process.env.INIT === 'true';
if (!INIT) {
  console.log('Skipping seed — set INIT=true to seed initial data.');
  process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// Location tables are now created by Drizzle migration — no cleanup needed

/**
 * Run SQL migrations from the migrations directory
 */
async function runMigrations(client: any) {
  const migrationsDir = path.join(
    __dirname,
    '..',
    'src',
    'core',
    'database',
    'migrations',
  );

  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    return;
  }

  console.log('Running database migrations...\n');

  for (const fileName of migrationFiles) {
    const filePath = path.join(migrationsDir, fileName);
    try {
      const sql = fs.readFileSync(filePath, 'utf-8');
      // Split by Drizzle's statement-breakpoint marker and run each statement individually
      const statements = sql
        .split('--> statement-breakpoint')
        .map((s: string) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        try {
          await client.query(stmt);
        } catch (stmtErr: any) {
          // Skip "already exists" errors for individual statements
          if (
            stmtErr.message.includes('already exists') ||
            stmtErr.code === '42P07' ||
            stmtErr.code === '42701'
          ) {
            // Silently skip
          } else {
            throw stmtErr;
          }
        }
      }
      console.log(`  ${fileName}`);
    } catch (err: any) {
      // Skip "already exists" errors
      if (
        err.message.includes('already exists') ||
        err.code === '42P07' ||
        err.code === '42701'
      ) {
        console.log(`  ${fileName} (already applied)`);
      } else {
        console.warn(`  ${fileName}: ${err.message}`);
      }
    }
  }

  console.log();
}

const seeds = [
  { name: 'country', fn: seedCountries },
  { name: 'state', fn: seedStateTable },
  { name: 'district', fn: seedDistrictTable },
  { name: 'pincode', fn: seedPincodeTable },
  { name: 'communication_type', fn: seedCommunicationTypes },
  { name: 'notes_type', fn: seedNotesTypes },
  { name: 'contact_person_type', fn: seedContactPersonTypes },
  { name: 'volumes', fn: seedVolumes },
  { name: 'entity', fn: seedEntities },
  { name: 'system_roles', fn: seedSystemRoles },
  { name: 'entity_type',            fn: seedEntityTypes },          // ← Must run before super_admin_permissions
  { name: 'permission_actions',     fn: seedPermissionActions },     // ← Must run before super_admin_permissions
  { name: 'super_admin_permissions', fn: seedSuperAdminPermissions }, // ← Depends on system_roles + entity_type + permission_actions
  { name: 'routes', fn: seedRoutes },
  { name: 'role_route_mapping', fn: seedRoleRouteMappings },
  // Lookup Tables
  { name: 'store_legal_type', fn: seedStoreLegalTypes },
  { name: 'store_category', fn: seedStoreCategories },
  { name: 'address_type', fn: seedAddressTypes },
  { name: 'salutation_type', fn: seedSalutationTypes },
  { name: 'designation_type', fn: seedDesignationTypes },
  { name: 'billing_frequency', fn: seedBillingFrequencies },
  { name: 'notification_status', fn: seedNotificationStatuses },
  { name: 'staff_invite_status', fn: seedStaffInviteStatuses },
  { name: 'tax_registration_type', fn: seedTaxRegistrationTypes },
  { name: 'tax_filing_frequency', fn: seedTaxFilingFrequencies },
  { name: 'plan_type', fn: seedPlanTypes },
  { name: 'tax_line_status', fn: seedTaxLineStatuses },
  // Subscription System
  { name: 'currencies', fn: seedCurrencies },
  { name: 'subscription_status', fn: seedSubscriptionStatus },
  // Tax Engine (runs after country — tax_agencies references country)
  { name: 'tax_agencies', fn: seedTaxAgencies },
  { name: 'tax_names', fn: seedTaxNames },
  { name: 'tax_levels', fn: seedTaxLevels },
  { name: 'tax_level_mapping', fn: seedTaxLevelMappings },
  // Tax Master Data (commodity codes and rates for multi-country support)
  { name: 'commodity_codes', fn: seedCommodityCodes },
  { name: 'tax_rate_master', fn: seedTaxRateMaster },
];

async function seed() {
  const client = await pool.connect();

  // Run migrations first
  await runMigrations(client);

  client.release();

  console.log('Starting seed...\n');
  let success = 0;
  let failed = 0;

  for (const { name, fn } of seeds) {
    try {
      const result = await fn(db);
      const inserted = (result as any)?.rowCount ?? 0;
      console.log(`  ${name}: ${inserted} inserted`);
      success++;
    } catch (err: any) {
      console.error(`  ${name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nSeed complete — ${success} succeeded, ${failed} failed`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
