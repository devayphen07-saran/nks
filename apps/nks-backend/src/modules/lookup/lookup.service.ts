import { Injectable } from '@nestjs/common';
import { LookupRepository } from './lookup.repository';
import * as schema from '../../core/database/schema';

type StoreLegalType = typeof schema.storeLegalType.$inferSelect;
type Salutation = typeof schema.salutation.$inferSelect;
type Designation = typeof schema.designation.$inferSelect;

@Injectable()
export class LookupService {
  constructor(private readonly lookupRepository: LookupRepository) {}

  getStoreLegalTypes(): Promise<StoreLegalType[]> {
    return this.lookupRepository.findAllStoreLegalTypes();
  }
  getSalutations(): Promise<Salutation[]> {
    return this.lookupRepository.findAllSalutations();
  }
  getDialCodes() {
    return this.lookupRepository.findAllDialCodes();
  }
  getDesignations(): Promise<Designation[]> {
    return this.lookupRepository.findAllDesignations();
  }

  getStoreCategories(): Promise<(typeof schema.storeCategory.$inferSelect)[]> {
    return this.lookupRepository.findAllStoreCategories();
  }

  getCountries() {
    return this.lookupRepository.findAllCountries();
  }

  async getGlobalConfig() {
    const [
      storeCategories,
      storeLegalTypes,
      salutations,
      designations,
      countries,
    ] = await Promise.all([
      this.getStoreCategories(),
      this.getStoreLegalTypes(),
      this.getSalutations(),
      this.getDesignations(),
      this.getCountries(),
    ]);

    return {
      storeCategories,
      storeLegalTypes,
      salutations,
      designations,
      countries,
    };
  }

  // Store Legal Types CRUD
  async createStoreLegalType(
    data: {
      legalTypeName: string;
      legalTypeCode: string;
      description?: string;
    },
    userId: number,
  ) {
    return this.lookupRepository.createStoreLegalType({
      ...data,
      createdBy: userId,
    });
  }

  async updateStoreLegalType(
    id: number,
    data: {
      legalTypeName?: string;
      legalTypeCode?: string;
      description?: string;
    },
    userId: number,
  ) {
    return this.lookupRepository.updateStoreLegalType(id, {
      ...data,
      modifiedBy: userId,
    });
  }

  async deleteStoreLegalType(id: number, userId: number) {
    return this.lookupRepository.softDeleteStoreLegalType(id, userId);
  }

  // Salutations CRUD
  async createSalutation(
    data: { salutationText: string; description?: string },
    userId: number,
  ) {
    return this.lookupRepository.createSalutation({
      ...data,
      createdBy: userId,
    });
  }

  async updateSalutation(
    id: number,
    data: { salutationText?: string; description?: string },
    userId: number,
  ) {
    return this.lookupRepository.updateSalutation(id, {
      ...data,
      modifiedBy: userId,
    });
  }

  async deleteSalutation(id: number, userId: number) {
    return this.lookupRepository.softDeleteSalutation(id, userId);
  }

  // Store Categories CRUD
  async createStoreCategory(
    data: { categoryName: string; categoryCode: string; description?: string },
    userId: number,
  ) {
    return this.lookupRepository.createStoreCategory({
      ...data,
      createdBy: userId,
    });
  }

  async updateStoreCategory(
    id: number,
    data: {
      categoryName?: string;
      categoryCode?: string;
      description?: string;
    },
    userId: number,
  ) {
    return this.lookupRepository.updateStoreCategory(id, {
      ...data,
      modifiedBy: userId,
    });
  }

  async deleteStoreCategory(id: number, userId: number) {
    return this.lookupRepository.softDeleteStoreCategory(id, userId);
  }

  // Designations CRUD
  async createDesignation(
    data: { designationName: string; designationCode: string },
    userId: number,
  ) {
    return this.lookupRepository.createDesignation({
      ...data,
      createdBy: userId,
    });
  }

  async updateDesignation(
    id: number,
    data: { designationName?: string; designationCode?: string },
    userId: number,
  ) {
    return this.lookupRepository.updateDesignation(id, {
      ...data,
      modifiedBy: userId,
    });
  }

  async deleteDesignation(id: number, userId: number) {
    return this.lookupRepository.softDeleteDesignation(id, userId);
  }
}
