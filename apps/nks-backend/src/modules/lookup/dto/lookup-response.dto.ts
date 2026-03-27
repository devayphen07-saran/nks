import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Store Legal Type
const StoreLegalTypeResponseSchema = z.object({
  id: z.number(),
  guuid: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().nullable(),
});

export class StoreLegalTypeResponseDto extends createZodDto(
  StoreLegalTypeResponseSchema,
) {}

// Salutation
const SalutationResponseSchema = z.object({
  id: z.number(),
  guuid: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().nullable(),
});

export class SalutationResponseDto extends createZodDto(
  SalutationResponseSchema,
) {}

// Dial Code (phone prefix picker — sourced from country.dialCode)
const DialCodeResponseSchema = z.object({
  id: z.number(),
  countryName: z.string(),
  countryCode: z.string(),
  dialCode: z.string(),
});

export class DialCodeResponseDto extends createZodDto(DialCodeResponseSchema) {}

// Designation
const DesignationResponseSchema = z.object({
  id: z.number(),
  guuid: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().nullable(),
});

export class DesignationResponseDto extends createZodDto(
  DesignationResponseSchema,
) {}
