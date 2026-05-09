import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { lookup } from '../schema';
import type { LookupRow, InsertLookup } from '../schema';
import { createLogger } from '../../utils/logger';

const log = createLogger('LookupRepository');

export class LookupRepository {
  private get db() {
    return getDatabase();
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  /**
   * Bulk upsert from a sync pull response.
   * Conflicts on guuid (the stable server-side identifier).
   */
  async batchUpsert(rows: InsertLookup[]): Promise<void> {
    if (!rows.length) return;
    try {
      await this.db
        .insert(lookup)
        .values(rows)
        .onConflictDoUpdate({
          target: lookup.guuid,
          set: {
            lookup_type_id:   sql`excluded.lookup_type_id`,
            lookup_type_code: sql`excluded.lookup_type_code`,
            code:             sql`excluded.code`,
            label:            sql`excluded.label`,
            description:      sql`excluded.description`,
            store_id:         sql`excluded.store_id`,
            is_active:        sql`excluded.is_active`,
            is_system:        sql`excluded.is_system`,
            is_hidden:        sql`excluded.is_hidden`,
            sort_order:       sql`excluded.sort_order`,
            version:          sql`excluded.version`,
            updated_at:       sql`excluded.updated_at`,
            deleted_at:       sql`excluded.deleted_at`,
          },
        });
    } catch (err) {
      log.error(`batchUpsert failed for ${rows.length} lookups:`, err);
    }
  }

  /** Soft-delete a batch of lookup rows by id. */
  async batchSoftDelete(ids: number[]): Promise<void> {
    if (!ids.length) return;
    try {
      await this.db
        .update(lookup)
        .set({ is_active: 0, deleted_at: sql`datetime('now')` })
        .where(inArray(lookup.id, ids));
    } catch (err) {
      log.error(`batchSoftDelete failed for ${ids.length} ids:`, err);
    }
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  /**
   * All active, visible global values for a lookup type.
   * Used to populate dropdowns for: salutations, currencies, store categories, etc.
   */
  async findByTypeCode(typeCode: string): Promise<LookupRow[]> {
    try {
      return await this.db
        .select()
        .from(lookup)
        .where(
          and(
            eq(lookup.lookup_type_code, typeCode),
            isNull(lookup.store_id),
            eq(lookup.is_active, 1),
            eq(lookup.is_hidden, 0),
            isNull(lookup.deleted_at),
          ),
        )
        .orderBy(lookup.sort_order, lookup.label);
    } catch (err) {
      log.error(`findByTypeCode failed for type=${typeCode}:`, err);
      return [];
    }
  }

  /**
   * All active, visible values for a type within a specific store.
   * Returns both global values (store_id IS NULL) and store-scoped values.
   */
  async findByTypeCodeAndStore(typeCode: string, storeId: number): Promise<LookupRow[]> {
    try {
      return await this.db
        .select()
        .from(lookup)
        .where(
          and(
            eq(lookup.lookup_type_code, typeCode),
            sql`(${lookup.store_id} IS NULL OR ${lookup.store_id} = ${storeId})`,
            eq(lookup.is_active, 1),
            eq(lookup.is_hidden, 0),
            isNull(lookup.deleted_at),
          ),
        )
        .orderBy(lookup.sort_order, lookup.label);
    } catch (err) {
      log.error(`findByTypeCodeAndStore failed for type=${typeCode} store=${storeId}:`, err);
      return [];
    }
  }

  /** Find a single lookup by its guuid. */
  async findByGuuid(guuid: string): Promise<LookupRow | null> {
    try {
      const rows = await this.db
        .select()
        .from(lookup)
        .where(eq(lookup.guuid, guuid))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      log.error(`findByGuuid failed for guuid=${guuid}:`, err);
      return null;
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  /**
   * Hard-delete all rows scoped to a single store. Global rows
   * (store_id IS NULL) are preserved — they apply to every store.
   * Used when switching away from a store so its custom lookups don't
   * leak into the next store's session.
   */
  async deleteByStoreId(storeId: number): Promise<void> {
    try {
      await this.db.delete(lookup).where(eq(lookup.store_id, storeId));
    } catch (err) {
      log.error(`deleteByStoreId failed for storeId=${storeId}:`, err);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.db.delete(lookup);
    } catch (err) {
      log.error('clear failed:', err);
    }
  }
}

export const lookupRepository = new LookupRepository();
