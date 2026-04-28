import { Injectable, Logger } from '@nestjs/common';
import { LocationRepository } from './repositories/location.repository';
import { LocationMapper } from './location.mapper';
import type { StateResponse, DistrictResponse, PincodeResponse } from './dto/location-response.dto';
import { LocationValidator } from './validators';
import { paginated } from '../../../common/utils/paginated-result';
import type { PaginatedResult } from '../../../common/utils/paginated-result';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly locationRepository: LocationRepository,
  ) {}

  async listStates(search?: string, sortBy = 'name', sortOrder = 'asc', isActive?: boolean): Promise<StateResponse[]> {
    const rows = await this.locationRepository.getStates(search, sortBy, sortOrder, isActive);
    return rows.map(LocationMapper.buildStateDto);
  }

  async getStateByCode(code: string): Promise<StateResponse> {
    const state = await this.locationRepository.getStateByCode(code);
    LocationValidator.assertStateFound(state);
    return LocationMapper.buildStateDto(state);
  }

  async listDistrictsByStateCode(
    code: string,
    search?: string,
    sortBy = 'name',
    sortOrder = 'asc',
    isActive?: boolean,
  ): Promise<DistrictResponse[]> {
    const districts = await this.locationRepository.getDistrictsByStateCode(code, search, sortBy, sortOrder, isActive);
    LocationValidator.assertDistrictsFound(districts);
    return districts.map(LocationMapper.buildDistrictDto);
  }

  async listPincodes(
    districtGuuid: string,
    opts: { page: number; pageSize: number; search?: string; sortBy?: string; sortOrder?: string; isActive?: boolean },
  ): Promise<PaginatedResult<PincodeResponse>> {
    const district = await this.locationRepository.getDistrictByGuuid(districtGuuid);
    LocationValidator.assertDistrictFound(district);
    const { rows, total } = await this.locationRepository.getPincodesByDistrict(district.id, district.guuid, opts);
    return paginated({
      items: rows.map(LocationMapper.buildPincodeDto),
      page: opts.page,
      pageSize: opts.pageSize,
      total,
    });
  }

  async getPincodeByCode(code: string): Promise<PincodeResponse> {
    const pincode = await this.locationRepository.getPincodeByCode(code);
    LocationValidator.assertPincodeFound(pincode);
    return LocationMapper.buildPincodeDto(pincode);
  }
}
