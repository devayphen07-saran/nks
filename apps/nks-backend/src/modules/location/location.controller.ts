import { Controller, Get, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { LocationService } from './location.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { ApiResponse } from '../../common/utils/api-response';
import { CountryResponseDto, StateResponseDto, CityResponseDto } from './dto';
import { LocationMapper } from './mapper';

@ApiTags('Location')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Public()
  @Get('countries')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all active countries' })
  @SwaggerResponse({ type: [CountryResponseDto] })
  async countries() {
    const data = await this.locationService.getCountries();
    const mapped = data.map((d) => LocationMapper.toCountryResponseDto(d));
    return ApiResponse.ok(mapped);
  }

  @Get('countries/:countryId/states')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'countryId',
    type: Number,
    description: 'Country primary key',
  })
  @ApiOperation({ summary: 'List all states/provinces for a country' })
  @SwaggerResponse({ type: [StateResponseDto] })
  async states(@Param('countryId', ParseIdPipe) countryId: number) {
    const data = await this.locationService.getStatesByCountry(countryId);
    const mapped = data.map((d) => LocationMapper.toStateResponseDto(d));
    return ApiResponse.ok(mapped);
  }

  @Get('states/:stateId/cities')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'stateId',
    type: Number,
    description: 'State/province primary key',
  })
  @ApiOperation({ summary: 'List all cities for a state/province' })
  @SwaggerResponse({ type: [CityResponseDto] })
  async cities(@Param('stateId', ParseIdPipe) stateId: number) {
    const data = await this.locationService.getCitiesByState(stateId);
    const mapped = data.map((d) => LocationMapper.toCityResponseDto(d));
    return ApiResponse.ok(mapped);
  }
}
