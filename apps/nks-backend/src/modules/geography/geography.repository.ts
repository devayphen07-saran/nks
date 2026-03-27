import { Injectable } from '@nestjs/common';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

@Injectable()
export class GeographyRepository {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  findAllCountries() {
    return this.db
      .select()
      .from(schema.country)
      .where(eq(schema.country.isActive, true))
      .orderBy(schema.country.countryName);
  }

  findStatesByCountry(countryId: number) {
    return this.db
      .select()
      .from(schema.stateRegionProvince)
      .where(eq(schema.stateRegionProvince.countryFk, countryId))
      .orderBy(schema.stateRegionProvince.stateName);
  }

  /**
   * Finds unique city names within a state by joining pincodes and districts.
   * Replaces the deleted flat 'city' table.
   */
  findCitiesByState(stateId: number) {
    return this.db
      .selectDistinct({ cityName: schema.pincode.cityName })
      .from(schema.pincode)
      .innerJoin(
        schema.district,
        eq(schema.pincode.districtFk, schema.district.id),
      )
      .where(eq(schema.district.stateRegionProvinceFk, stateId))
      .orderBy(schema.pincode.cityName);
  }

  findPincodesByDistrict(districtId: number) {
    return this.db
      .select({
        id: schema.pincode.id,
        pincode: schema.pincode.postalCode,
        cityName: schema.pincode.cityName,
      })
      .from(schema.pincode)
      .where(eq(schema.pincode.districtFk, districtId))
      .orderBy(schema.pincode.cityName);
  }
}
