import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LocationService } from './location.service';
import { Public } from '../../../common/decorators/public.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import {
  PincodeResponse,
  StateResponse,
  DistrictResponse,
  LocationSearchQueryDto,
  PincodeQueryDto,
  StateCodeParamDto,
  PincodeParamDto,
  DistrictGuuidParamDto,
} from './dto';
import type { PaginatedResult } from '../../../common/utils/paginated-result';

@ApiTags('Location')
@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('states/list')
  @Public()
  @ResponseMessage('States retrieved successfully')
  @ApiOperation({ summary: 'List all states' })
  async getStates(
    @Query() query: LocationSearchQueryDto,
  ): Promise<StateResponse[]> {
    return this.locationService.listStates(query.search, query.sortBy, query.sortOrder, query.isActive);
  }

  @Get('states/code/:code')
  @Public()
  @ResponseMessage('State retrieved successfully')
  @ApiOperation({ summary: 'Get state by code' })
  async getStateByCode(
    @Param() params: StateCodeParamDto,
  ): Promise<StateResponse> {
    return this.locationService.getStateByCode(params.code);
  }

  @Get('states/:code/districts')
  @Public()
  @ResponseMessage('Districts retrieved successfully')
  @ApiOperation({ summary: 'Get districts for a state by state code' })
  async getDistrictsByState(
    @Param() params: StateCodeParamDto,
    @Query() query: LocationSearchQueryDto,
  ): Promise<DistrictResponse[]> {
    return this.locationService.listDistrictsByStateCode(
      params.code,
      query.search,
      query.sortBy,
      query.sortOrder,
      query.isActive,
    );
  }

  @Get('districts/:districtGuuid/pincodes')
  @Public()
  @ResponseMessage('Pincodes retrieved successfully')
  @ApiOperation({ summary: 'Get pincodes for a district' })
  async listPincodes(
    @Param() params: DistrictGuuidParamDto,
    @Query() query: PincodeQueryDto,
  ): Promise<PaginatedResult<PincodeResponse>> {
    return this.locationService.listPincodes(params.districtGuuid, query);
  }

  @Get('pincodes/:code')
  @Public()
  @ResponseMessage('Pincode retrieved successfully')
  @ApiOperation({ summary: 'Get pincode by code' })
  async getPincodeByCode(
    @Param() params: PincodeParamDto,
  ): Promise<PincodeResponse> {
    return this.locationService.getPincodeByCode(params.code);
  }
}
