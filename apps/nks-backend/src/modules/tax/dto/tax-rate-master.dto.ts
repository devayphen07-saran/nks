import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TaxRateMasterSchema = z.object({
  id: z.number(),
  countryFk: z.number(),
  storeFk: z.number(),
  commodityCodeFk: z.number(),
  baseTaxRate: z.string().max(10),
  component1Rate: z.string().max(10).optional(),
  component2Rate: z.string().max(10).optional(),
  component3Rate: z.string().max(10).optional(),
  additionalRate: z.string().max(10).optional(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
  isActive: z.boolean().default(true),
});

export class TaxRateMasterDto extends createZodDto(TaxRateMasterSchema) {}

const CreateTaxRateMasterSchema = z.object({
  countryFk: z.number(),
  storeFk: z.number(),
  commodityCodeFk: z.number(),
  baseTaxRate: z.string().min(1).max(10),
  component1Rate: z.string().max(10).optional(),
  component2Rate: z.string().max(10).optional(),
  component3Rate: z.string().max(10).optional(),
  additionalRate: z.string().max(10).optional(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
});

export class CreateTaxRateMasterDto extends createZodDto(
  CreateTaxRateMasterSchema,
) {}

const TaxRateMasterListSchema = z.object({
  id: z.number(),
  baseTaxRate: z.string(),
  component1Rate: z.string().optional(),
  component2Rate: z.string().optional(),
  component3Rate: z.string().optional(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
  isActive: z.boolean(),
});

export class TaxRateMasterListDto extends createZodDto(
  TaxRateMasterListSchema,
) {}
