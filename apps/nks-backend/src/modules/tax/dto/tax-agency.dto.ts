import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TaxAgencySchema = z.object({
  id: z.number(),
  code: z.string().max(50),
  name: z.string().max(255),
  countryFk: z.number().optional(),
  description: z.string().max(1000).optional(),
  referenceUrl: z.string().max(500).optional(),
});

export class TaxAgencyDto extends createZodDto(TaxAgencySchema) {}

const CreateTaxAgencySchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  countryFk: z.number().optional(),
  description: z.string().max(1000).optional(),
  referenceUrl: z.string().max(500).optional(),
});

export class CreateTaxAgencyDto extends createZodDto(CreateTaxAgencySchema) {}
