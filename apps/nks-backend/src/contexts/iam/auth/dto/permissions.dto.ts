import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SessionInfoSchema = z.object({
  guuid: z.string(),
  deviceId: z.string().nullable(),
  deviceName: z.string().nullable(),
  deviceType: z.string().nullable(),
  platform: z.string().nullable(),
  appVersion: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export const SessionListSchema = z.object({
  sessions: z.array(SessionInfoSchema),
  currentSessionId: z.string().nullable(),
  total: z.number(),
});

// ─── DTOs ─────────────────────────────────────────────────────────────────

export class SessionInfoDto extends createZodDto(SessionInfoSchema) {}
export class SessionListDto extends createZodDto(SessionListSchema) {}
