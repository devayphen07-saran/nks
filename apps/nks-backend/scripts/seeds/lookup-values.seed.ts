import type { Db } from './types.js';

/**
 * DEPRECATED: plan types and billing frequencies have been moved to
 * code_category / code_value (seeded by seedCodeTable under PLAN_TYPE and
 * BILLING_FREQUENCY categories). The `lookup` table is no longer used.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function seedLookupValues(_db: Db) {
  // no-op — values now live in code_value via seedCodeTable
}
