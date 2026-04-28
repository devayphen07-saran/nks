import { eq, isNull, and, sql, inArray } from "drizzle-orm";
import { getDatabase } from "../connection";
import { district } from "../schema";
import type { DistrictRow } from "../schema";
import { createLogger } from "../../utils/logger";

const log = createLogger("DistrictRepository");

export class DistrictRepository {
  private get db() {
    return getDatabase();
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  async upsert(row: DistrictRow): Promise<void> {
    await this.batchUpsert([row]);
  }

  /**
   * Bulk INSERT OR REPLACE in a single statement.
   * Uses `excluded.*` to reference the conflicting row's values.
   */
  async batchUpsert(rows: DistrictRow[]): Promise<void> {
    if (!rows.length) return;
    try {
      await this.db
        .insert(district)
        .values(rows)
        .onConflictDoUpdate({
          target: district.guuid,
          set: {
            district_name: sql`excluded.district_name`,
            district_code: sql`excluded.district_code`,
            lgd_code:      sql`excluded.lgd_code`,
            state_guuid:   sql`excluded.state_guuid`,
            is_active:     sql`excluded.is_active`,
            updated_at:    sql`excluded.updated_at`,
            deleted_at:    sql`excluded.deleted_at`,
          },
        });
    } catch (err) {
      log.error(`Failed to batch-upsert ${rows.length} districts:`, err);
    }
  }

  /** Mark a district as soft-deleted. Called when server emits operation:'delete'. */
  async softDelete(id: number): Promise<void> {
    await this.batchSoftDelete([id]);
  }

  /** Soft-delete multiple districts in one statement. */
  async batchSoftDelete(ids: number[]): Promise<void> {
    if (!ids.length) return;
    try {
      await this.db
        .update(district)
        .set({ is_active: 0, deleted_at: sql`datetime('now')` })
        .where(inArray(district.id, ids));
    } catch (err) {
      log.error(`Failed to batch soft-delete ${ids.length} districts:`, err);
    }
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async findByState(stateGuuid: string): Promise<DistrictRow[]> {
    try {
      return await this.db
        .select()
        .from(district)
        .where(
          and(
            eq(district.state_guuid, stateGuuid),
            eq(district.is_active, 1),
            isNull(district.deleted_at),
          ),
        )
        .orderBy(district.district_name);
    } catch (err) {
      log.error("Failed to find districts by state:", err);
      return [];
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  async clear(): Promise<void> {
    try {
      await this.db.delete(district);
    } catch (err) {
      log.error("Failed to clear districts:", err);
    }
  }
}

export const districtRepository = new DistrictRepository();
