import { Injectable, NotFoundException } from '@nestjs/common';
import { LocationRepository } from './location.repository';
import { ErrorCode } from '../../common/constants/error-codes.constants';
import * as schema from '../../core/database/schema';

type Country = typeof schema.country.$inferSelect;
type State = typeof schema.stateRegionProvince.$inferSelect;
type PostalCodeRow = { id: number; code: string; cityName: string };

@Injectable()
export class LocationService {
  constructor(private readonly locationRepository: LocationRepository) {}

  getCountries(): Promise<Country[]> {
    return this.locationRepository.findAllCountries();
  }

  async getStatesByCountry(countryId: number): Promise<State[]> {
    const states = await this.locationRepository.findStatesByCountry(countryId);
    if (!states.length) {
      throw new NotFoundException({
        errorCode: ErrorCode.COUNTRY_NOT_FOUND,
        message: `No states found for country ID ${countryId}`,
      });
    }
    return states;
  }

  async getCitiesByState(stateId: number): Promise<{ cityName: string }[]> {
    const cities = await this.locationRepository.findCitiesByState(stateId);
    if (!cities.length) {
      throw new NotFoundException({
        errorCode: ErrorCode.STATE_NOT_FOUND,
        message: `No cities found for state id ${stateId}`,
      });
    }
    return cities;
  }

  async getPostalCodesByAdminDiv(adminDivId: number): Promise<PostalCodeRow[]> {
    const records =
      await this.locationRepository.findPostalCodesByAdminDiv(adminDivId);
    if (!records.length) {
      throw new NotFoundException({
        errorCode: ErrorCode.NOT_FOUND,
        message: `No postal codes found for administrative division ID ${adminDivId}`,
      });
    }
    return records;
  }
}
