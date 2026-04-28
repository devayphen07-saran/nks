import { eq, isNull, and, sql, inArray } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { state } from '../schema';
import type { StateRow } from '../schema';
import { createLogger } from '../../utils/logger';

const log = createLogger('StateRepository');

export class StateRepository {
  private get db() { return getDatabase(); }

  // ── Write ──────────────────────────────────────────────────────────────────

  async upsert(row: StateRow): Promise<void> {
    await this.batchUpsert([row]);
  }

  /**
   * Bulk INSERT OR REPLACE in a single statement.
   * Uses `excluded.*` to reference the conflicting row's values so each
   * column is updated to what was in the inserted row, not to a fixed JS
   * variable (which would snapshot the first row in older Drizzle versions).
   */
  async batchUpsert(rows: StateRow[]): Promise<void> {
    if (!rows.length) return;
    try {
      await this.db
        .insert(state)
        .values(rows)
        .onConflictDoUpdate({
          target: state.guuid,
          set: {
            state_name:         sql`excluded.state_name`,
            state_code:         sql`excluded.state_code`,
            gst_state_code:     sql`excluded.gst_state_code`,
            is_union_territory: sql`excluded.is_union_territory`,
            is_active:          sql`excluded.is_active`,
            updated_at:         sql`excluded.updated_at`,
            deleted_at:         sql`excluded.deleted_at`,
          },
        });
    } catch (err) {
      log.error(`Failed to batch-upsert ${rows.length} states:`, err);
    }
  }

  /** Mark a state as soft-deleted. Called when server emits operation:'delete'. */
  async softDelete(id: number): Promise<void> {
    await this.batchSoftDelete([id]);
  }

  /** Soft-delete multiple states in one statement. */
  async batchSoftDelete(ids: number[]): Promise<void> {
    if (!ids.length) return;
    try {
      await this.db
        .update(state)
        .set({ is_active: 0, deleted_at: sql`datetime('now')` })
        .where(inArray(state.id, ids));
    } catch (err) {
      log.error(`Failed to batch soft-delete ${ids.length} states:`, err);
    }
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async findAll(): Promise<StateRow[]> {
    try {
      return await this.db
        .select()
        .from(state)
        .where(and(eq(state.is_active, 1), isNull(state.deleted_at)))
        .orderBy(state.state_name);
    } catch (err) {
      log.error('Failed to find all states:', err);
      return [];
    }
  }

  async findByCode(code: string): Promise<StateRow | null> {
    try {
      const result = await this.db
        .select()
        .from(state)
        .where(and(eq(state.state_code, code), isNull(state.deleted_at)))
        .limit(1);
      return result[0] ?? null;
    } catch (err) {
      log.error('Failed to find state by code:', err);
      return null;
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  async clear(): Promise<void> {
    try {
      await this.db.delete(state);
    } catch (err) {
      log.error('Failed to clear states:', err);
    }
  }
}

export const stateRepository = new StateRepository();
