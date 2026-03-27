import { Injectable } from '@nestjs/common';
import { LookupRepository } from './lookup.repository';
import * as schema from '../../core/database/schema';

type StoreLegalType = typeof schema.storeLegalType.$inferSelect;
type Salutation = typeof schema.salutation.$inferSelect;
type Designation = typeof schema.designation.$inferSelect;

@Injectable()
export class LookupService {
  constructor(private readonly repo: LookupRepository) {}

  getStoreLegalTypes(): Promise<StoreLegalType[]> {
    return this.repo.findAllStoreLegalTypes();
  }
  getSalutations(): Promise<Salutation[]> {
    return this.repo.findAllSalutations();
  }
  getDialCodes() {
    return this.repo.findAllDialCodes();
  }
  getDesignations(): Promise<Designation[]> {
    return this.repo.findAllDesignations();
  }
}
