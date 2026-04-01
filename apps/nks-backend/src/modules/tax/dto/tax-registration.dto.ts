import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TaxRegistrationSchema = z.object({
  id: z.number(),
  storeFk: z.number(),
  countryFk: z.number(),
  taxAgencyFk: z.number(),
  taxNameFk: z.number(),
  registrationNumber: z.string().max(100),
  regionCode: z.string().max(20).optional(),
  registrationType: z.enum(['REGULAR', 'COMPOSITION']).default('REGULAR'),
  label: z.string().max(255).optional(),
  filingFrequency: z
    .enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY'])
    .default('MONTHLY'),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
});

export class TaxRegistrationDto extends createZodDto(TaxRegistrationSchema) {}

const CreateTaxRegistrationSchema = z.object({
  storeFk: z.number(),
  countryFk: z.number(),
  taxAgencyFk: z.number(),
  taxNameFk: z.number(),
  registrationNumber: z.string().min(1).max(100),
  regionCode: z.string().max(20).optional(),
  registrationType: z.enum(['REGULAR', 'COMPOSITION']).optional(),
  label: z.string().max(255).optional(),
  filingFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY']).optional(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
});

export class CreateTaxRegistrationDto extends createZodDto(
  CreateTaxRegistrationSchema,
) {}

const TaxRegistrationDetailSchema = z.object({
  id: z.number(),
  registrationNumber: z.string(),
  registrationType: z.string(),
  label: z.string().optional(),
  filingFrequency: z.string(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
  agencyName: z.string().optional(),
  taxName: z.string().optional(),
});

export class TaxRegistrationDetailDto extends createZodDto(
  TaxRegistrationDetailSchema,
) {}
