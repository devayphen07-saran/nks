import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const NotificationResponseSchema = z.object({
  id: z.number(),
  guuid: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()).nullable().optional(),
  readAt: z.string().nullable(),
  sentAt: z.string().nullable(),
  createdAt: z.string(),
});

export class NotificationResponseDto extends createZodDto(
  NotificationResponseSchema,
) {}

export const SendNotificationSchema = z.object({
  userId: z.number().int().positive(),
  type: z.string().max(50),
  title: z.string().max(255),
  body: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export class SendNotificationDto extends createZodDto(SendNotificationSchema) {}
