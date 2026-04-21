import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Mobile Verify DTO - Verify JWT token claims and check for permission changes
 */
const MobileVerifySchema = z.object({
  token: z.string().min(1, 'Token is required'),
  permissionsVersion: z.string().optional(),
});
export class MobileVerifyDto extends createZodDto(MobileVerifySchema) {}

/**
 * Permissions Delta Sync DTO - Get only changed permissions since version
 */
const PermissionsDeltaSyncSchema = z.object({
  sinceVersion: z.string().optional().default('v1'),
});
export class PermissionsDeltaSyncDto extends createZodDto(PermissionsDeltaSyncSchema) {}

/**
 * Device Session Response DTO
 */
const DeviceSessionResponseSchema = z.object({
  id: z.string(),
  deviceId: z.string().nullable(),
  deviceName: z.string().nullable(),
  deviceType: z.enum(['ios', 'android', 'web']).nullable(),
  appVersion: z.string().nullable(),
  platform: z.enum(['ios', 'android', 'web']).nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  lastAccessAt: z.string().nullable(),
  expiresAt: z.string(),
});
export class DeviceSessionResponseDto extends createZodDto(DeviceSessionResponseSchema) {}

/**
 * Device Session List Response
 */
const DeviceSessionListSchema = z.object({
  sessions: z.array(DeviceSessionResponseSchema),
  currentSessionId: z.string().nullable(),
  total: z.number(),
});
export class DeviceSessionListResponseDto extends createZodDto(DeviceSessionListSchema) {}

/**
 * Permissions Snapshot Response
 */
const PermissionSchema = z.object({
  canView: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  deny: z.boolean(),
});

const PermissionsSnapshotSchema = z.object({
  version: z.string(),
  snapshot: z.record(z.string(), PermissionSchema),
});
export class PermissionsSnapshotResponseDto extends createZodDto(PermissionsSnapshotSchema) {}

/**
 * Permissions Delta Response
 */
const PermissionsDeltaSchema = z.object({
  version: z.string(),
  sinceVersion: z.string(),
  added: z.record(z.string(), PermissionSchema).optional(),
  removed: z.record(z.string(), PermissionSchema).optional(),
  modified: z.record(z.string(), PermissionSchema).optional(),
});
export class PermissionsDeltaResponseDto extends createZodDto(PermissionsDeltaSchema) {}
