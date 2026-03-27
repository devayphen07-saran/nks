import { Injectable, NotFoundException } from '@nestjs/common';
import { GeographyRepository } from './geography.repository';
import { ErrorCode } from '../../common/constants/error-codes.constants';
import * as schema from '../../core/database/schema';

type Country = typeof schema.country.$inferSelect;
type State = typeof schema.stateRegionProvince.$inferSelect;
type PincodeRow = { id: number; pincode: string; cityName: string };

@Injectable()
export class GeographyService {
  constructor(private readonly repo: GeographyRepository) {}

  getCountries(): Promise<Country[]> {
    return this.repo.findAllCountries();
  }

  async getStatesByCountry(countryId: number): Promise<State[]> {
    const states = await this.repo.findStatesByCountry(countryId);
    if (!states.length) {
      throw new NotFoundException({
        errorCode: ErrorCode.COUNTRY_NOT_FOUND,
        message: `No states found for country ID ${countryId}`,
      });
    }
    return states;
  }

  async getCitiesByState(stateId: number): Promise<{ cityName: string }[]> {
    const cities = await this.repo.findCitiesByState(stateId);
    if (!cities.length) {
      throw new NotFoundException({
        errorCode: ErrorCode.STATE_NOT_FOUND,
        message: `No cities found for state id ${stateId}`,
      });
    }
    return cities;
  }

  async getPincodesByDistrict(districtId: number): Promise<PincodeRow[]> {
    const records = await this.repo.findPincodesByDistrict(districtId);
    if (!records.length) {
      throw new NotFoundException({
        errorCode: ErrorCode.NOT_FOUND,
        message: `No pincodes found for district ID ${districtId}`,
      });
    }
    return records;
  }
}
