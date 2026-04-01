import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CommodityCodeSchema = z.object({
  id: z.number(),
  countryFk: z.number(),
  code: z.string().max(10),
  type: z.enum(['HSN', 'SAC', 'HS', 'CN', 'UNSPSC']),
  digits: z.enum(['4', '6', '8', '10']).optional(),
  description: z.string().max(1000),
  displayName: z.string().max(255).optional(),
  defaultTaxRate: z.string(),
  isExempted: z.boolean().default(false),
});

export class CommodityCodeDto extends createZodDto(CommodityCodeSchema) {}

const CreateCommodityCodeSchema = z.object({
  countryFk: z.number(),
  code: z.string().min(1).max(10),
  type: z.enum(['HSN', 'SAC', 'HS', 'CN', 'UNSPSC']),
  digits: z.enum(['4', '6', '8', '10']).optional(),
  description: z.string().min(1).max(1000),
  displayName: z.string().max(255).optional(),
  defaultTaxRate: z.string().optional(),
  isExempted: z.boolean().optional(),
});

export class CreateCommodityCodeDto extends createZodDto(
  CreateCommodityCodeSchema,
) {}

const CommodityCodeListSchema = z.object({
  id: z.number(),
  code: z.string(),
  type: z.string(),
  displayName: z.string().optional(),
  defaultTaxRate: z.string().optional(),
});

export class CommodityCodeListDto extends createZodDto(
  CommodityCodeListSchema,
) {}
