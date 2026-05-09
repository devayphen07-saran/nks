import { eq, sql } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { stores } from '../schema';
import type { StoreRow, InsertStore } from '../schema';
import { createLogger } from '../../utils/logger';

const log = createLogger('StoresRepository');

export type ReplicationStatus = 'pending' | 'in_progress' | 'complete' | 'failed' | 'paused';

export class StoresRepository {
  private get db() { return getDatabase(); }

  async upsertMany(rows: InsertStore[]): Promise<void> {
    if (!rows.length) return;
    for (const row of rows) {
      await this.db
        .insert(stores)
        .values(row)
        .onConflictDoUpdate({
          target: stores.guuid,
          set: {
            name:      row.name,
            address:   row.address,
            phone:     row.phone,
            updatedAt: Date.now(),
          },
        });
    }
  }

  async findAll(): Promise<StoreRow[]> {
    return this.db.select().from(stores);
  }

  async findById(id: number): Promise<StoreRow | null> {
    const rows = await this.db.select().from(stores).where(eq(stores.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByGuuid(guuid: string): Promise<StoreRow | null> {
    const rows = await this.db.select().from(stores).where(eq(stores.guuid, guuid)).limit(1);
    return rows[0] ?? null;
  }

  async updateStatus(id: number, status: ReplicationStatus, error?: string): Promise<void> {
    const current = await this.findById(id);
    if (!current) {
      log.warn(`updateStatus: store ${id} not found`);
      return;
    }
    await this.db
      .update(stores)
      .set({
        replicationStatus:  status,
        replicationError:   error ?? null,
        currentState:       status,
        previousState:      current.currentState,
        stateTransitionAt:  Date.now(),
        updatedAt:          Date.now(),
      })
      .where(eq(stores.id, id));
  }

  async markComplete(id: number): Promise<void> {
    await this.db
      .update(stores)
      .set({
        replicationStatus: 'complete',
        currentState:      'complete',
        lastReplicatedAt:  Date.now(),
        updatedAt:         Date.now(),
      })
      .where(eq(stores.id, id));
  }

  async setDefault(id: number): Promise<void> {
    await this.db.update(stores).set({ isDefaultStore: 0, updatedAt: Date.now() });
    await this.db
      .update(stores)
      .set({ isDefaultStore: 1, updatedAt: Date.now() })
      .where(eq(stores.id, id));
  }

  async touchAccessed(id: number): Promise<void> {
    await this.db
      .update(stores)
      .set({ lastAccessedAt: Date.now() })
      .where(eq(stores.id, id));
  }

  async countAll(): Promise<number> {
    const result = await this.db.select({ count: sql<number>`count(*)` }).from(stores);
    return result[0]?.count ?? 0;
  }

  async clear(): Promise<void> {
    await this.db.delete(stores);
  }
}

export const storesRepository = new StoresRepository();
