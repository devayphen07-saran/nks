import { Injectable } from '@nestjs/common';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, isNotNull } from 'drizzle-orm';

@Injectable()
export class LookupRepository {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  findAllStoreLegalTypes() {
    return this.db
      .select()
      .from(schema.storeLegalType)
      .where(eq(schema.storeLegalType.isActive, true))
      .orderBy(schema.storeLegalType.legalTypeName);
  }

  findAllSalutations() {
    return this.db
      .select()
      .from(schema.salutation)
      .where(eq(schema.salutation.isActive, true))
      .orderBy(schema.salutation.salutationText);
  }

  // Returns countries that have a dial code — used for the phone prefix picker.
  // Replaces the removed calling_code table; data lives directly on country.
  findAllDialCodes() {
    return this.db
      .select({
        id: schema.country.id,
        countryName: schema.country.countryName,
        countryCode: schema.country.isoCode2,
        dialCode: schema.country.dialCode,
      })
      .from(schema.country)
      .where(isNotNull(schema.country.dialCode))
      .orderBy(schema.country.dialCode);
  }

  findAllDesignations() {
    return this.db
      .select()
      .from(schema.designation)
      .where(eq(schema.designation.isActive, true))
      .orderBy(schema.designation.designationName);
  }
}
