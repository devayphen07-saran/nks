import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const StoreItemSchema = z.object({
  id: z.number(),
  storeName: z.string(),
  storeCode: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
});

const StoreDetailSchema = StoreItemSchema.extend({
  description: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

const StoreListResponseSchema = z.object({
  items: z.array(StoreItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export class StoreItemDto extends createZodDto(StoreItemSchema) {}
export class StoreDetailDto extends createZodDto(StoreDetailSchema) {}
export class StoreListResponseDto extends createZodDto(
  StoreListResponseSchema,
) {}
