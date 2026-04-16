import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull } from 'drizzle-orm';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';

type State = typeof schema.state.$inferSelect;
type District = typeof schema.district.$inferSelect;
type Pincode = typeof schema.pincode.$inferSelect;

@Injectable()
export class LocationRepository {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  async getStates(): Promise<State[]> {
    return this.db
      .select()
      .from(schema.state)
      .where(and(eq(schema.state.isActive, true), isNull(schema.state.deletedAt)))
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

  async getDistrictsByState(stateId: number): Promise<District[]> {
    return this.db
      .select()
      .from(schema.district)
      .where(
        and(
          eq(schema.district.stateFk, stateId),
          eq(schema.district.isActive, true),
          isNull(schema.district.deletedAt),
        ),
      )
      .orderBy(schema.district.districtName);
  }

  async getDistrictsByStateCode(code: string): Promise<District[]> {
    const state = await this.getStateByCode(code);
    if (!state) return [];
    return this.getDistrictsByState(state.id);
  }

  async getPincodesByDistrict(districtId: number): Promise<Pincode[]> {
    return this.db
      .select()
      .from(schema.pincode)
      .where(
        and(
          eq(schema.pincode.districtFk, districtId),
          eq(schema.pincode.isActive, true),
          isNull(schema.pincode.deletedAt),
        ),
      )
      .orderBy(schema.pincode.code);
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
