import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { GeographyService } from './geography.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { ApiResponse } from '../../common/utils/api-response';
import { CountryResponseDto, StateResponseDto, CityResponseDto } from './dto';
import { GeographyMapper } from './mapper';

@ApiTags('Geography')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('geography')
export class GeographyController {
  constructor(private readonly geographyService: GeographyService) {}

  @Get('countries')
  @ApiOperation({ summary: 'List all active countries' })
  @SwaggerResponse({ type: [CountryResponseDto] })
  async countries() {
    const data = await this.geographyService.getCountries();
    const mapped = data.map((d) => GeographyMapper.toCountryResponseDto(d));
    return ApiResponse.ok(mapped);
  }

  @Get('countries/:countryId/states')
  @ApiParam({
    name: 'countryId',
    type: Number,
    description: 'Country primary key',
  })
  @ApiOperation({ summary: 'List all states/provinces for a country' })
  @SwaggerResponse({ type: [StateResponseDto] })
  async states(@Param('countryId', ParseIdPipe) countryId: number) {
    const data = await this.geographyService.getStatesByCountry(countryId);
    const mapped = data.map((d) => GeographyMapper.toStateResponseDto(d));
    return ApiResponse.ok(mapped);
  }

  @Get('states/:stateId/cities')
  @ApiParam({
    name: 'stateId',
    type: Number,
    description: 'State/province primary key',
  })
  @ApiOperation({ summary: 'List all cities for a state/province' })
  @SwaggerResponse({ type: [CityResponseDto] })
  async cities(@Param('stateId', ParseIdPipe) stateId: number) {
    const data = await this.geographyService.getCitiesByState(stateId);
    const mapped = data.map((d) => GeographyMapper.toCityResponseDto(d));
    return ApiResponse.ok(mapped);
  }
}
