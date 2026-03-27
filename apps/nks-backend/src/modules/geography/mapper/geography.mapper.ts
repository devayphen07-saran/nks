import {
  CountryResponseDto,
  StateResponseDto,
  CityResponseDto,
} from '../dto/geography-response.dto';
import type {
  Country,
  StateRegionProvince,
} from '../../../core/database/schema';

// Shape returned by GeographyRepository.findCitiesByState()
type CityRow = { cityName: string };

export class GeographyMapper {
  static toCountryResponseDto(entity: Country): CountryResponseDto {
    return {
      id: entity.id,
      guuid: entity.guuid,
      name: entity.countryName,
      isoCodeAlpha2: entity.isoCode2,
      isoCodeAlpha3: null, // country table stores only isoCode2; alpha3 not available
      sortOrder: entity.sortOrder ?? null,
    };
  }

  static toStateResponseDto(entity: StateRegionProvince): StateResponseDto {
    return {
      id: entity.id,
      guuid: entity.guuid,
      countryFk: entity.countryFk,
      name: entity.stateName,
      code: entity.stateCode ?? null,
      sortOrder: entity.sortOrder ?? null,
    };
  }

  static toCityResponseDto(entity: CityRow): CityResponseDto {
    return { cityName: entity.cityName };
  }
}
