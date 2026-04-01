import { Injectable } from '@nestjs/common';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, isNotNull, and } from 'drizzle-orm';

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

  // Returns ACTIVE countries that have a dial code — used for the phone prefix picker.
  // Filters by isActive=true for phased rollout support.
  // Data lives directly on country table.
  findAllDialCodes() {
    return this.db
      .select({
        id: schema.country.id,
        countryName: schema.country.countryName,
        isoCode2: schema.country.isoCode2,
        dialCode: schema.country.dialCode,
        currencyCode: schema.country.currencyCode,
        currencySymbol: schema.country.currencySymbol,
        timezone: schema.country.timezone,
        isActive: schema.country.isActive,
      })
      .from(schema.country)
      .where(
        and(
          eq(schema.country.isActive, true),
          isNotNull(schema.country.dialCode),
        ),
      )
      .orderBy(schema.country.sortOrder);
  }

  findAllDesignations() {
    return this.db
      .select()
      .from(schema.designation)
      .where(eq(schema.designation.isActive, true))
      .orderBy(schema.designation.designationName);
  }

  findAllStoreCategories() {
    return this.db
      .select()
      .from(schema.storeCategory)
      .where(eq(schema.storeCategory.isActive, true))
      .orderBy(schema.storeCategory.categoryName);
  }

  findAllCountries() {
    return this.db
      .select({
        id: schema.country.id,
        name: schema.country.countryName,
        code: schema.country.isoCode2,
        dialCode: schema.country.dialCode,
      })
      .from(schema.country)
      .where(eq(schema.country.isActive, true))
      .orderBy(schema.country.countryName);
  }

  // Store Legal Types CRUD
  createStoreLegalType(data: {
    legalTypeName: string;
    legalTypeCode: string;
    description?: string;
    createdBy: number;
  }) {
    return this.db
      .insert(schema.storeLegalType)
      .values({
        legalTypeName: data.legalTypeName,
        legalTypeCode: data.legalTypeCode,
        description: data.description,
        isActive: true,
        createdBy: data.createdBy,
        modifiedBy: data.createdBy,
      })
      .returning();
  }

  updateStoreLegalType(
    id: number,
    data: {
      legalTypeName?: string;
      legalTypeCode?: string;
      description?: string;
      modifiedBy: number;
    },
  ) {
    return this.db
      .update(schema.storeLegalType)
      .set({
        ...(data.legalTypeName && { legalTypeName: data.legalTypeName }),
        ...(data.legalTypeCode && { legalTypeCode: data.legalTypeCode }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        modifiedBy: data.modifiedBy,
      })
      .where(eq(schema.storeLegalType.id, id))
      .returning();
  }

  softDeleteStoreLegalType(id: number, deletedBy: number) {
    return this.db
      .update(schema.storeLegalType)
      .set({
        isActive: false,
        deletedAt: new Date(),
        modifiedBy: deletedBy,
      })
      .where(eq(schema.storeLegalType.id, id))
      .returning();
  }

  // Salutations CRUD
  createSalutation(data: {
    salutationText: string;
    description?: string;
    createdBy: number;
  }) {
    return this.db
      .insert(schema.salutation)
      .values({
        salutationText: data.salutationText,
        description: data.description,
        isActive: true,
        createdBy: data.createdBy,
        modifiedBy: data.createdBy,
      })
      .returning();
  }

  updateSalutation(
    id: number,
    data: { salutationText?: string; description?: string; modifiedBy: number },
  ) {
    return this.db
      .update(schema.salutation)
      .set({
        ...(data.salutationText && { salutationText: data.salutationText }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        modifiedBy: data.modifiedBy,
      })
      .where(eq(schema.salutation.id, id))
      .returning();
  }

  softDeleteSalutation(id: number, deletedBy: number) {
    return this.db
      .update(schema.salutation)
      .set({
        isActive: false,
        deletedAt: new Date(),
        modifiedBy: deletedBy,
      })
      .where(eq(schema.salutation.id, id))
      .returning();
  }

  // Store Categories CRUD
  createStoreCategory(data: {
    categoryName: string;
    categoryCode: string;
    description?: string;
    createdBy: number;
  }) {
    return this.db
      .insert(schema.storeCategory)
      .values({
        categoryName: data.categoryName,
        categoryCode: data.categoryCode,
        description: data.description,
        isActive: true,
        createdBy: data.createdBy,
        modifiedBy: data.createdBy,
      })
      .returning();
  }

  updateStoreCategory(
    id: number,
    data: {
      categoryName?: string;
      categoryCode?: string;
      description?: string;
      modifiedBy: number;
    },
  ) {
    return this.db
      .update(schema.storeCategory)
      .set({
        ...(data.categoryName && { categoryName: data.categoryName }),
        ...(data.categoryCode && { categoryCode: data.categoryCode }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        modifiedBy: data.modifiedBy,
      })
      .where(eq(schema.storeCategory.id, id))
      .returning();
  }

  softDeleteStoreCategory(id: number, deletedBy: number) {
    return this.db
      .update(schema.storeCategory)
      .set({
        isActive: false,
        deletedAt: new Date(),
        modifiedBy: deletedBy,
      })
      .where(eq(schema.storeCategory.id, id))
      .returning();
  }

  // Designations CRUD (Global only - no store scope)
  createDesignation(data: {
    designationName: string;
    designationCode: string;
    createdBy: number;
  }) {
    return this.db
      .insert(schema.designation)
      .values({
        designationName: data.designationName,
        designationCode: data.designationCode,
        storeFk: null,
        isActive: true,
        createdBy: data.createdBy,
        modifiedBy: data.createdBy,
      })
      .returning();
  }

  updateDesignation(
    id: number,
    data: {
      designationName?: string;
      designationCode?: string;
      modifiedBy: number;
    },
  ) {
    return this.db
      .update(schema.designation)
      .set({
        ...(data.designationName && { designationName: data.designationName }),
        ...(data.designationCode && { designationCode: data.designationCode }),
        modifiedBy: data.modifiedBy,
      })
      .where(eq(schema.designation.id, id))
      .returning();
  }

  softDeleteDesignation(id: number, deletedBy: number) {
    return this.db
      .update(schema.designation)
      .set({
        isActive: false,
        deletedAt: new Date(),
        modifiedBy: deletedBy,
      })
      .where(eq(schema.designation.id, id))
      .returning();
  }
}
