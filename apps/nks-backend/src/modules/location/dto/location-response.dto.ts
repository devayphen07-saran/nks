import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Country
const CountryResponseSchema = z.object({
  id: z.number(),
  guuid: z.string(),
  name: z.string(),
  isoCodeAlpha2: z.string(),
  isoCodeAlpha3: z.string().nullable(), // country table only has isoCode2; alpha3 is not stored
  sortOrder: z.number().nullable(),
});

export class CountryResponseDto extends createZodDto(CountryResponseSchema) {}

// State / Province
const StateResponseSchema = z.object({
  id: z.number(),
  guuid: z.string(),
  countryFk: z.number(),
  name: z.string(),
  code: z.string().nullable(),
  sortOrder: z.number().nullable(),
});

export class StateResponseDto extends createZodDto(StateResponseSchema) {}

// City — derived from distinct cityName values in the postal_code table (no id/stateFk)
const CityResponseSchema = z.object({
  cityName: z.string(),
});

export class CityResponseDto extends createZodDto(CityResponseSchema) {}
