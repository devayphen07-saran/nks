import { eq } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { permissionConstraints } from '../schema';

/**
 * Cleanup helpers for the per-store permission-constraints table.
 *
 * The read/write API was removed when the Phase 6 permission validator
 * (which would consume it) never landed. Re-add only with a real caller.
 */
export class PermissionConstraintsRepository {
  private get db() { return getDatabase(); }

  async deleteByStoreId(storeId: number): Promise<void> {
    await this.db
      .delete(permissionConstraints)
      .where(eq(permissionConstraints.storeId, storeId));
  }

  async clear(): Promise<void> {
    await this.db.delete(permissionConstraints);
  }
}

export const permissionConstraintsRepository = new PermissionConstraintsRepository();
