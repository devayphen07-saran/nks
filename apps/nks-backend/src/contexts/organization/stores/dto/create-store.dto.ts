import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateStoreSchema = z.object({
  storeName: z.string().trim().min(2).max(255),
  storeLegalTypeCode: z.string().trim().min(1),
  storeCategoryCode: z.string().trim().min(1),
  storeCode: z.string().trim().min(1).max(50).optional(),
  timezone: z.string().trim().min(1).max(60).optional().default('Asia/Kolkata'),
});

export class CreateStoreDto extends createZodDto(CreateStoreSchema) {}
