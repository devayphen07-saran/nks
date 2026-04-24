import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SetDefaultStoreSchema = z.object({
  storeGuuid: z.string().uuid('Invalid store ID'),
});

export class SetDefaultStoreDto extends createZodDto(SetDefaultStoreSchema) {}
