import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, count, asc, desc, or, sql } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm/column';
import { ilikeAny } from '../../../../core/database/query-helpers';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';

type State = typeof schema.state.$inferSelect;
type District = typeof schema.district.$inferSelect;
type Pincode = typeof schema.pincode.$inferSelect;

/**
 * Pull-sync row shapes — narrow projections returned by `findXxxChangesAfter`
 * methods. Live with the producer (this repo) and are consumed by the
 * domain's sync handler + the SyncDataMapper.
 */
export interface StateChangeRow {
  id: number;
  guuid: string;
  stateName: string;
  stateCode: string;
  gstStateCode: string | null;
  isUnionTerritory: boolean;
  isActive: boolean;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

export interface DistrictChangeRow {
  id: number;
  guuid: string;
  districtName: string;
  districtCode: string | null;
  lgdCode: string | null;
  stateGuuid: string | null;
  isActive: boolean;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

@Injectable()
export class LocationRepository extends BaseRepository {
  constructor(@InjectDb() db: NodePgDatabase<typeof schema>) {
    super(db);
  }

  private resolveOrderColumn(
    sortBy: string,
    columnMap: Record<string, AnyColumn>,
    defaultKey: string,
  ): AnyColumn {
    return columnMap[sortBy] ?? columnMap[defaultKey];
  }

  private applySortDirection(column: AnyColumn, sortOrder: string = 'asc') {
    return sortOrder === 'desc' ? desc(column) : asc(column);
  }

  /**
   * Phase 1: Helper to build isActive filter
   * true = active only, false = inactive only, undefined = active only (default)
   */
  async getStates(
    search?: string,
    sortBy = 'name',
    sortOrder = 'asc',
    isActive?: boolean,
  ): Promise<State[]> {
    const activeFilter = eq(schema.state.isActive, isActive ?? true);

    const whereConditions = [
      isNull(schema.state.deletedAt),
      activeFilter,
      ilikeAny(search, schema.state.stateName, schema.state.stateCode),
    ].filter((c): c is typeof c & {} => c !== null);

    return this.db
      .select()
      .from(schema.state)
      .where(and(...whereConditions))
      .orderBy(this.applySortDirection(this.resolveOrderColumn(sortBy, {
        code: schema.state.stateCode,
        createdAt: schema.state.createdAt,
        name: schema.state.stateName,
      }, 'name'), sortOrder));
  }

  async getDistrictByGuuid(guuid: string): Promise<District | null> {
    const [result] = await this.db
      .select()
      .from(schema.district)
      .where(
        and(
          eq(schema.district.guuid, guuid),
          eq(schema.district.isActive, true),
          isNull(schema.district.deletedAt),
        ),
      )
      .limit(1);

    return result ?? null;
  }

  async getStateByCode(code: string): Promise<State | null> {
    const [result] = await this.db
      .select()
      .from(schema.state)
      .where(
        and(
          eq(schema.state.stateCode, code),
          eq(schema.state.isActive, true),
          isNull(schema.state.deletedAt),
        ),
      )
      .limit(1);

    return result ?? null;
  }

  async getDistrictsByState(
    stateId: number,
    search?: string,
  ): Promise<District[]> {
    return this.db
      .select()
      .from(schema.district)
      .where(
        and(
          eq(schema.district.stateFk, stateId),
          eq(schema.district.isActive, true),
          isNull(schema.district.deletedAt),
          ilikeAny(search, schema.district.districtName),
        ),
      )
      .orderBy(schema.district.districtName);
  }

  async getDistrictsByStateCode(
    code: string,
    search?: string,
    sortBy = 'name',
    sortOrder = 'asc',
    isActive?: boolean,
  ): Promise<(District & { stateGuuid: string })[] | null> {
    const state = await this.getStateByCode(code);
    if (!state) return null;

    const districtActiveFilter = isActive === undefined ? true : isActive;
    const districts = await this.db
      .select()
      .from(schema.district)
      .where(
        and(
          eq(schema.district.stateFk, state.id),
          eq(schema.district.isActive, districtActiveFilter),
          isNull(schema.district.deletedAt),
          ilikeAny(search, schema.district.districtName),
        ),
      )
      .orderBy(this.applySortDirection(this.resolveOrderColumn(sortBy, {
        code: schema.district.districtCode,
        createdAt: schema.district.createdAt,
        name: schema.district.districtName,
      }, 'name'), sortOrder));

    return districts.map((d) => ({ ...d, stateGuuid: state.guuid }));
  }

  async getPincodesByDistrict(
    districtId: number,
    districtGuuid: string,
    opts: { page: number; pageSize: number; search?: string; sortBy?: string; sortOrder?: string; isActive?: boolean },
  ): Promise<{ rows: (Pincode & { districtGuuid: string })[]; total: number }> {
    const { page, pageSize, search, sortBy = 'code', sortOrder = 'asc', isActive } = opts;
    const offset = LocationRepository.toOffset(page, pageSize);
    const pincodeActiveFilter = isActive === undefined ? true : isActive;

    const where = and(
      eq(schema.pincode.districtFk, districtId),
      eq(schema.pincode.isActive, pincodeActiveFilter),
      isNull(schema.pincode.deletedAt),
      ilikeAny(
        search,
        schema.pincode.code,
        schema.pincode.localityName,
        schema.pincode.areaName,
      ),
    );

    const { rows, total } = await this.paginate(
      this.db
        .select()
        .from(schema.pincode)
        .where(where)
        .orderBy(this.applySortDirection(this.resolveOrderColumn(sortBy, {
          area: schema.pincode.areaName,
          createdAt: schema.pincode.createdAt,
          code: schema.pincode.code,
        }, 'code'), sortOrder))
        .limit(pageSize)
        .offset(offset),
      () => this.db.select({ total: count() }).from(schema.pincode).where(where),
      page, pageSize,
    );

    return { rows: rows.map((p) => ({ ...p, districtGuuid })), total };
  }

  /**
   * Pull-sync read for `state`. Compound cursor (updatedAt, id) breaks ties when
   * rows share an updated_at — without it pagination silently skips or duplicates
   * rows committed in the same millisecond. Fetches `limit + 1` so callers
   * detect `hasMore` without a separate COUNT.
   */
  async findStateChangesAfter(
    cursorMs: number,
    cursorId: number,
    limit: number,
  ): Promise<StateChangeRow[]> {
    const cursorDate = new Date(cursorMs);
    return this.db
      .select({
        id: schema.state.id,
        guuid: schema.state.guuid,
        stateName: schema.state.stateName,
        stateCode: schema.state.stateCode,
        gstStateCode: schema.state.gstStateCode,
        isUnionTerritory: schema.state.isUnionTerritory,
        isActive: schema.state.isActive,
        updatedAt: schema.state.updatedAt,
        deletedAt: schema.state.deletedAt,
      })
      .from(schema.state)
      .where(
        or(
          sql`${schema.state.updatedAt} > ${cursorDate}`,
          and(
            sql`${schema.state.updatedAt} = ${cursorDate}`,
            sql`${schema.state.id} > ${cursorId}`,
          ),
        ),
      )
      .orderBy(schema.state.updatedAt, schema.state.id)
      .limit(limit);
  }

  /**
   * Pull-sync read for `district`. Same compound-cursor semantics as
   * `findStateChangesAfter`. Joins state for `stateGuuid` so mobile resolves
   * the FK without a follow-up query.
   */
  async findDistrictChangesAfter(
    cursorMs: number,
    cursorId: number,
    limit: number,
  ): Promise<DistrictChangeRow[]> {
    const cursorDate = new Date(cursorMs);
    return this.db
      .select({
        id: schema.district.id,
        guuid: schema.district.guuid,
        districtName: schema.district.districtName,
        districtCode: schema.district.districtCode,
        lgdCode: schema.district.lgdCode,
        stateGuuid: schema.state.guuid,
        isActive: schema.district.isActive,
        updatedAt: schema.district.updatedAt,
        deletedAt: schema.district.deletedAt,
      })
      .from(schema.district)
      .leftJoin(schema.state, eq(schema.district.stateFk, schema.state.id))
      .where(
        or(
          sql`${schema.district.updatedAt} > ${cursorDate}`,
          and(
            sql`${schema.district.updatedAt} = ${cursorDate}`,
            sql`${schema.district.id} > ${cursorId}`,
          ),
        ),
      )
      .orderBy(schema.district.updatedAt, schema.district.id)
      .limit(limit);
  }

  async getPincodeByCode(code: string): Promise<(Pincode & { districtGuuid: string }) | null> {
    const [result] = await this.db
      .select({
        id: schema.pincode.id,
        guuid: schema.pincode.guuid,
        code: schema.pincode.code,
        localityName: schema.pincode.localityName,
        areaName: schema.pincode.areaName,
        districtFk: schema.pincode.districtFk,
        districtGuuid: schema.district.guuid,
        latitude: schema.pincode.latitude,
        longitude: schema.pincode.longitude,
        sortOrder: schema.pincode.sortOrder,
        isActive: schema.pincode.isActive,
        isHidden: schema.pincode.isHidden,
        isSystem: schema.pincode.isSystem,
        createdAt: schema.pincode.createdAt,
        updatedAt: schema.pincode.updatedAt,
        deletedAt: schema.pincode.deletedAt,
        createdBy: schema.pincode.createdBy,
        modifiedBy: schema.pincode.modifiedBy,
        deletedBy: schema.pincode.deletedBy,
      })
      .from(schema.pincode)
      .innerJoin(schema.district, eq(schema.pincode.districtFk, schema.district.id))
      .where(
        and(
          eq(schema.pincode.code, code),
          eq(schema.pincode.isActive, true),
          isNull(schema.pincode.deletedAt),
        ),
      )
      .limit(1);

    return result ?? null;
  }
}
