import { eq } from 'drizzle-orm';
import type { Db } from '../types.js';
import { status } from '../../../src/core/database/schema/entity-system/status/index.js';
import { entityStatusMapping } from '../../../src/core/database/schema/entity-system/entity-status-mapping/entity-status-mapping.table.js';

/**
 * entityCode values are lowercase (EntityCodeValidator normalizes to lowercase).
 * Statuses that don't exist yet are silently skipped — the seed is safe to
 * re-run and survives partial status tables.
 *
 * Mapping rationale:
 *  store          → lifecycle (draft → active → inactive) + verify/archive
 *  user           → active / inactive / pending
 *  invoice        → full financial lifecycle incl. partial payment + overdue
 *  product        → draft → active → inactive → archived
 *  purchase_order → approval workflow + fulfilment
 *  customer       → active / inactive / archived
 *  vendor         → active / inactive / archived
 *  inventory      → active / inactive
 *  transaction    → async processing lifecycle
 *  payment        → financial outcomes
 */
// Keys must match entity_type.code (SCREAMING_SNAKE_CASE) — FK enforced in DB.
const ENTITY_STATUS_MAP: Record<string, string[]> = {
  STORE:          ['DRAFT', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'VERIFIED', 'ARCHIVED', 'CLOSED'],
  USER:           ['ACTIVE', 'INACTIVE', 'PENDING'],
  INVOICE:        ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELED', 'CLOSED'],
  PRODUCT:        ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
  PURCHASE_ORDER: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'],
  CUSTOMER:       ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
  VENDOR:         ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
  INVENTORY:      ['ACTIVE', 'INACTIVE'],
  TRANSACTION:    ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELED'],
  PAYMENT:        ['PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'FAILED', 'CANCELED'],
};

export async function seedEntityStatusMappings(db: Db): Promise<{ rowCount: number }> {
  const allStatuses = await db
    .select({ id: status.id, code: status.code })
    .from(status)
    .where(eq(status.isActive, true));

  if (allStatuses.length === 0) {
    throw new Error('No statuses found — run business_statuses and subscription_status seeds first.');
  }

  const statusMap = new Map(allStatuses.map((s) => [s.code, s.id]));

  const rows: typeof entityStatusMapping.$inferInsert[] = [];
  for (const [entityCode, codes] of Object.entries(ENTITY_STATUS_MAP)) {
    for (const code of codes) {
      const statusId = statusMap.get(code);
      if (!statusId) continue; // skip if status wasn't seeded
      rows.push({ entityCode, statusFk: statusId, isActive: true });
    }
  }

  if (rows.length === 0) return { rowCount: 0 };

  await db.insert(entityStatusMapping).values(rows).onConflictDoNothing();
  return { rowCount: rows.length };
}
