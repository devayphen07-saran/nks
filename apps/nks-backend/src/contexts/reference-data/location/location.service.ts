import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
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
  async getStates(search?: string): Promise<StateListResponse> {
    return this.locationRepository.getStates(search);
  }

  /**
   * Get state by state code
   */
  async getStateByCode(code: string): Promise<StateResponse> {
    // SECURITY: Validate state code format using StateCodeValidator
    StateCodeValidator.validate(code);

    const state = await this.locationRepository.getStateByCode(code);

    if (!state) {
      throw new NotFoundException(errPayload(ErrorCode.STATE_NOT_FOUND));
    }

    return state;
  }

  /**
   * Get districts by state code (e.g. 'KA', 'MH')
   */
  async getDistrictsByStateCode(code: string, search?: string): Promise<DistrictListResponse> {
    StateCodeValidator.validate(code);

    const state = await this.locationRepository.getStateByCode(code);
    if (!state) {
      throw new NotFoundException(errPayload(ErrorCode.STATE_NOT_FOUND));
    }

    return this.locationRepository.getDistrictsByState(state.id, search);
  }

  /**
   * Get pincodes by district ID
   */
  async listPincodes(
    districtId: number,
    opts: { page: number; pageSize: number; search?: string },
  ): Promise<{ rows: PincodeListResponse; total: number }> {
    const { rows, total } = await this.locationRepository.getPincodesByDistrict(districtId, opts);
    return { rows, total };
  }

  /**
   * Get pincode by code (6-digit PIN)
   */
  async getPincodeByCode(code: string): Promise<PincodeResponse> {
    // SECURITY: Validate pincode format using PincodeValidator
    PincodeValidator.validate(code);

    const pincode = await this.locationRepository.getPincodeByCode(code);

    if (!pincode) {
      throw new NotFoundException(errPayload(ErrorCode.POSTAL_CODE_NOT_FOUND));
    }

    return pincode;
  }
}
