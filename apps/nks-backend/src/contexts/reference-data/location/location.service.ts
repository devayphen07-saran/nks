import { Injectable, Logger } from '@nestjs/common';
import { LocationRepository } from './repositories/location.repository';
import { LocationMapper } from './location.mapper';
import type { StateResponse, DistrictResponse, PincodeResponse } from './dto/location-response.dto';
import { LocationValidator } from './validators';
import { paginated } from '../../../common/utils/paginated-result';
import type { PaginatedResult } from '../../../common/utils/paginated-result';

type ListOpts = {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  isActive?: boolean;
};

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly locationRepository: LocationRepository,
  ) {}

  async listStates(opts: ListOpts): Promise<PaginatedResult<StateResponse>> {
    const { rows, total } = await this.locationRepository.getStates(opts);
    return paginated({
      items: rows.map(LocationMapper.buildStateDto),
      page: opts.page,
      pageSize: opts.pageSize,
      total,
    });
  }

  async getStateByCode(code: string): Promise<StateResponse> {
    const state = await this.locationRepository.getStateByCode(code);
    LocationValidator.assertStateFound(state);
    return LocationMapper.buildStateDto(state);
  }

  async listDistrictsByStateCode(
    code: string,
    opts: ListOpts,
  ): Promise<PaginatedResult<DistrictResponse>> {
    const result = await this.locationRepository.getDistrictsByStateCode(code, opts);
    LocationValidator.assertDistrictsFound(result);
    return paginated({
      items: result.rows.map(LocationMapper.buildDistrictDto),
      page: opts.page,
      pageSize: opts.pageSize,
      total: result.total,
    });
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