import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const StoreRegisterResponseSchema = z.object({
  storeId: z.number(),
  storeCode: z.string(),
  role: z.string(),
});

export class StoreRegisterResponseDto extends createZodDto(
  StoreRegisterResponseSchema,
) {}
