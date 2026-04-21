import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, count } from 'drizzle-orm';
import { ilikeAny } from '../../../../core/database/query-helpers';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';

type State = typeof schema.state.$inferSelect;
type District = typeof schema.district.$inferSelect;
type Pincode = typeof schema.pincode.$inferSelect;

@Injectable()
export class LocationRepository extends BaseRepository {
  constructor(@InjectDb() db: NodePgDatabase<typeof schema>) { super(db); }

  async getStates(search?: string): Promise<State[]> {
    return this.db
      .select()
      .from(schema.state)
      .where(
        and(
          eq(schema.state.isActive, true),
          isNull(schema.state.deletedAt),
          ilikeAny(search, schema.state.stateName, schema.state.stateCode),
        ),
      )
      .orderBy(schema.state.stateName);
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

  async getDistrictsByState(stateId: number, search?: string): Promise<District[]> {
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

  async getDistrictsByStateCode(code: string, search?: string): Promise<District[]> {
    const state = await this.getStateByCode(code);
    if (!state) return [];
    return this.getDistrictsByState(state.id, search);
  }

  async getPincodesByDistrict(
    districtId: number,
    opts: { page: number; pageSize: number; search?: string },
  ): Promise<{ rows: Pincode[]; total: number }> {
    const { page, pageSize, search } = opts;
    const offset = (page - 1) * pageSize;

    const where = and(
      eq(schema.pincode.districtFk, districtId),
      eq(schema.pincode.isActive, true),
      isNull(schema.pincode.deletedAt),
      ilikeAny(search, schema.pincode.code, schema.pincode.localityName, schema.pincode.areaName),
    );

    return this.paginate(
      this.db.select().from(schema.pincode).where(where).orderBy(schema.pincode.code).limit(pageSize).offset(offset),
      this.db.select({ total: count() }).from(schema.pincode).where(where),
    );
  }

  async getPincodeByCode(code: string): Promise<Pincode | null> {
    const [result] = await this.db
      .select()
      .from(schema.pincode)
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
