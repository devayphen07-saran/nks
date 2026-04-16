import { Injectable, NotFoundException } from '@nestjs/common';
import { LocationRepository } from './repositories/location.repository';
import {
  StateResponse,
  StateListResponse,
  DistrictListResponse,
  PincodeListResponse,
  PincodeResponse,
} from './dto/location-response.dto';
import { StateCodeValidator, PincodeValidator } from './validators';

@Injectable()
export class LocationService {
  constructor(private readonly locationRepository: LocationRepository) {}

  /**
   * Get all active states
   */
  async getStates(): Promise<StateListResponse> {
    return this.locationRepository.getStates();
  }

  /**
   * Get state by state code
   */
  async getStateByCode(code: string): Promise<StateResponse> {
    // SECURITY: Validate state code format using StateCodeValidator
    StateCodeValidator.validate(code);

    const state = await this.locationRepository.getStateByCode(code);

    if (!state) {
      throw new NotFoundException(`State with code '${code}' not found`);
    }

    return state;
  }

  /**
   * Get districts by state code (e.g. 'KA', 'MH')
   */
  async getDistrictsByStateCode(code: string): Promise<DistrictListResponse> {
    StateCodeValidator.validate(code);

    const state = await this.locationRepository.getStateByCode(code);
    if (!state) {
      throw new NotFoundException(`State with code '${code}' not found`);
    }

    return this.locationRepository.getDistrictsByState(state.id);
  }

  /**
   * Get pincodes by district ID
   */
  async getPincodesByDistrict(districtId: number): Promise<PincodeListResponse> {
    return this.locationRepository.getPincodesByDistrict(districtId);
  }

  /**
   * Get pincode by code (6-digit PIN)
   */
  async getPincodeByCode(code: string): Promise<PincodeResponse> {
    // SECURITY: Validate pincode format using PincodeValidator
    PincodeValidator.validate(code);

    const pincode = await this.locationRepository.getPincodeByCode(code);

    if (!pincode) {
      throw new NotFoundException(`Pincode '${code}' not found`);
    }

    return pincode;
  }
}
