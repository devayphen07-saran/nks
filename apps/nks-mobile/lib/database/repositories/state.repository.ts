import { eq, isNull, and } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { state } from '../schema';
import type { StateRow } from '../schema';
import { createLogger } from '../../utils/logger';

const log = createLogger('StateRepository');

export class StateRepository {
  private get db() { return getDatabase(); }

  async upsert(row: StateRow): Promise<void> {
    try {
      await this.db
        .insert(state)
        .values(row)
        .onConflictDoUpdate({
          target: state.id,
          set: {
            state_name:         row.state_name,
            state_code:         row.state_code,
            gst_state_code:     row.gst_state_code,
            is_union_territory: row.is_union_territory,
            is_active:          row.is_active,
            updated_at:         row.updated_at,
            deleted_at:         row.deleted_at,
          },
        });
    } catch (err) {
      log.error('Failed to upsert state:', err);
    }
  }

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

  async clear(): Promise<void> {
    try {
      await this.db.delete(state);
    } catch (err) {
      log.error('Failed to clear states:', err);
    }
  }
}

export const stateRepository = new StateRepository();
