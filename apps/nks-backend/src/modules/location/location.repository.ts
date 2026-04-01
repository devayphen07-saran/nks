import { Injectable } from '@nestjs/common';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

@Injectable()
export class LocationRepository {
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
   * Finds unique city names within a state by joining postal_code and administrative divisions.
   * Replaces the deleted flat 'city' table.
   */
  findCitiesByState(stateId: number) {
    return this.db
      .selectDistinct({ cityName: schema.postalCode.cityName })
      .from(schema.postalCode)
      .innerJoin(
        schema.administrativeDivision,
        eq(
          schema.postalCode.administrativeDivisionFk,
          schema.administrativeDivision.id,
        ),
      )
      .where(eq(schema.administrativeDivision.stateRegionProvinceFk, stateId))
      .orderBy(schema.postalCode.cityName);
  }

  findPostalCodesByAdminDiv(adminDivId: number) {
    return this.db
      .select({
        id: schema.postalCode.id,
        code: schema.postalCode.code,
        cityName: schema.postalCode.cityName,
      })
      .from(schema.postalCode)
      .where(eq(schema.postalCode.administrativeDivisionFk, adminDivId))
      .orderBy(schema.postalCode.cityName);
  }
}
