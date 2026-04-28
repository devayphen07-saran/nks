/**
 * NKS Database Seed — Orchestrator (Simplified)
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/core/database/schema';

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
  seedLookupTypes,
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
  seedStoreOwnerPermissions,
  // Entity System
  seedBusinessStatuses,
  seedEntityStatusMappings,
} from './seeds';

const INIT = process.env.INIT === 'true';
if (!INIT) {
  console.log('Skipping seed — set INIT=true to seed initial data.');
  process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

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
  { name: 'entity_type', fn: seedEntityTypes }, // ← Must run before permissions
  { name: 'permission_actions', fn: seedPermissionActions }, // ← Must run before permissions
  { name: 'super_admin_permissions', fn: seedSuperAdminPermissions }, // ← Depends on system_roles + entity_type + permission_actions
  { name: 'store_owner_permissions', fn: seedStoreOwnerPermissions }, // ← Depends on system_roles + entity_type + permission_actions
  { name: 'routes', fn: seedRoutes },
  { name: 'role_route_mapping', fn: seedRoleRouteMappings },
  // Lookup Tables (lookup_type must run first — value seeds depend on it)
  { name: 'lookup_type', fn: seedLookupTypes },
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
  // Statuses (business first so ACTIVE/CANCELED get canonical colors; subscription adds its own codes)
  { name: 'business_statuses', fn: seedBusinessStatuses }, // ← Must run before entity_status_mappings
  // Subscription System
  { name: 'currencies', fn: seedCurrencies },
  { name: 'subscription_status', fn: seedSubscriptionStatus },
  // Entity status mappings — runs after all status seeds
  { name: 'entity_status_mappings', fn: seedEntityStatusMappings }, // ← Depends on business_statuses + subscription_status
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
