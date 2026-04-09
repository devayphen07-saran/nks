import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const PermissionsSnapshotSchema = z
  .object({
    version: z.string(),
    snapshot: z.record(z.string(), z.unknown()),
  })
  .describe('Permissions snapshot response');

export const PermissionsDeltaSchema = z
  .object({
    version: z.string(),
    sinceVersion: z.string(),
    added: z.record(z.string(), z.unknown()),
    removed: z.record(z.string(), z.unknown()),
    modified: z.record(z.string(), z.unknown()),
  })
  .describe('Permissions delta response');

export const SessionInfoSchema = z.object({
  id: z.number(),
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
  currentSessionId: z.number().nullable(),
  total: z.number(),
});

// ─── Query Schemas ────────────────────────────────────────────────────────

export const GetPermissionsDeltaQuerySchema = z.object({
  sinceVersion: z.string().default('v1'),
});

// ─── DTOs ─────────────────────────────────────────────────────────────────

export class PermissionsSnapshotDto extends createZodDto(PermissionsSnapshotSchema) {}
export class PermissionsDeltaDto extends createZodDto(PermissionsDeltaSchema) {}
export class SessionInfoDto extends createZodDto(SessionInfoSchema) {}
export class SessionListDto extends createZodDto(SessionListSchema) {}
export class GetPermissionsDeltaQueryDto extends createZodDto(GetPermissionsDeltaQuerySchema) {}
