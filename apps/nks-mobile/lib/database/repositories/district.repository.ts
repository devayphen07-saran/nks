import { eq, isNull, and } from "drizzle-orm";
import { getDatabase } from "../connection";
import { district } from "../schema";
import type { DistrictRow } from "../schema";
import { createLogger } from "../../utils/logger";

const log = createLogger("DistrictRepository");

export class DistrictRepository {
  private get db() {
    return getDatabase();
  }

  async upsert(row: DistrictRow): Promise<void> {
    try {
      await this.db
        .insert(district)
        .values(row)
        .onConflictDoUpdate({
          target: district.id,
          set: {
            district_name: row.district_name,
            district_code: row.district_code,
            lgd_code: row.lgd_code,
            state_fk: row.state_fk,
            is_active: row.is_active,
            updated_at: row.updated_at,
            deleted_at: row.deleted_at,
          },
        });
    } catch (err) {
      log.error("Failed to upsert district:", err);
    }
  }

  async findByState(stateFk: number): Promise<DistrictRow[]> {
    try {
      return await this.db
        .select()
        .from(district)
        .where(
          and(
            eq(district.state_fk, stateFk),
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

  async clear(): Promise<void> {
    try {
      await this.db.delete(district);
    } catch (err) {
      log.error("Failed to clear districts:", err);
    }
  }
}

export const districtRepository = new DistrictRepository();
