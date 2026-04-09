import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LocationService } from './location.service';
import { ApiResponse } from '../../common/utils/api-response';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import {
  StateListResponse,
  DistrictListResponse,
  PincodeListResponse,
  PincodeResponse,
  StateResponse,
} from './dto/location-response.dto';

@ApiTags('Location')
@Controller('location')
@UseGuards(AuthGuard)
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  /**
   * GET /location/states/list
   * Get all states
   * Public endpoint — no authentication required
   */
  @Get('states/list')
  @Public()
  @ApiOperation({ summary: 'List all states' })
  async getStates(): Promise<ApiResponse<StateListResponse>> {
    const result = await this.locationService.getStates();
    return ApiResponse.ok(result, 'States retrieved successfully');
  }

  /**
   * GET /location/states/code/:code
   * Get state by state code (e.g., 'KA' for Karnataka, 'MH' for Maharashtra)
   * Public endpoint — no authentication required
   */
  @Get('states/code/:code')
  @Public()
  @ApiOperation({ summary: 'Get state by code' })
  async getStateByCode(
    @Param('code') code: string,
  ): Promise<ApiResponse<StateResponse>> {
    const result = await this.locationService.getStateByCode(code);
    return ApiResponse.ok(result, 'State retrieved successfully');
  }

  /**
   * GET /location/states/:stateId/districts
   * Get all districts for a state
   * Public endpoint — no authentication required
   */
  @Get('states/:stateId/districts')
  @Public()
  @ApiOperation({ summary: 'Get districts for a state' })
  async getDistrictsByState(
    @Param('stateId') stateId: string,
  ): Promise<ApiResponse<DistrictListResponse>> {
    const result = await this.locationService.getDistrictsByState(
      Number(stateId),
    );
    return ApiResponse.ok(result, 'Districts retrieved successfully');
  }

  /**
   * GET /location/districts/:districtId/pincodes
   * Get all pincodes for a district
   * Public endpoint — no authentication required
   */
  @Get('districts/:districtId/pincodes')
  @Public()
  @ApiOperation({ summary: 'Get pincodes for a district' })
  async getPincodesByDistrict(
    @Param('districtId') districtId: string,
  ): Promise<ApiResponse<PincodeListResponse>> {
    const result = await this.locationService.getPincodesByDistrict(
      Number(districtId),
    );
    return ApiResponse.ok(result, 'Pincodes retrieved successfully');
  }

  /**
   * GET /location/pincodes/:code
   * Get pincode details by 6-digit code
   * Public endpoint — no authentication required
   */
  @Get('pincodes/:code')
  @Public()
  @ApiOperation({ summary: 'Get pincode by code' })
  async getPincodeByCode(
    @Param('code') code: string,
  ): Promise<ApiResponse<PincodeResponse>> {
    const result = await this.locationService.getPincodeByCode(code);
    return ApiResponse.ok(result, 'Pincode retrieved successfully');
  }
}
