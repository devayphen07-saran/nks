import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RegisterStoreSchema = z.object({
  storeName: z.string().min(1).max(255),
  storeCode: z.string().min(1).max(50).optional(),
  storeLegalTypeCode: z.string().min(1), // e.g. 'PVT_LTD'
  storeCategoryCode: z.string().min(1), // e.g. 'GROCERY'
  registrationNumber: z.string().max(100).optional(),
  taxNumber: z.string().max(100).optional(),
});

export class RegisterStoreDto extends createZodDto(RegisterStoreSchema) {}
