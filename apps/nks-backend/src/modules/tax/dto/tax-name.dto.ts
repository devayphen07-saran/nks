import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TaxNameSchema = z.object({
  id: z.number(),
  code: z.string().max(50),
  taxName: z.string().max(255),
  taxAgencyFk: z.number(),
  description: z.string().max(1000).optional(),
});

export class TaxNameDto extends createZodDto(TaxNameSchema) {}

const CreateTaxNameSchema = z.object({
  code: z.string().min(1).max(50),
  taxName: z.string().min(1).max(255),
  taxAgencyFk: z.number(),
  description: z.string().max(1000).optional(),
});

export class CreateTaxNameDto extends createZodDto(CreateTaxNameSchema) {}
