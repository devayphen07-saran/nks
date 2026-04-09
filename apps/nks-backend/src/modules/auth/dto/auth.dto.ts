import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SyncTimeSchema = z.object({
  deviceTime: z.number().int().positive('deviceTime must be a positive Unix timestamp in seconds'),
});

export class SyncTimeDto extends createZodDto(SyncTimeSchema) {}
