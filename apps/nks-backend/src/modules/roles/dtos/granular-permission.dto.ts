import { z } from 'zod';

/**
 * Granular Entity Permission - allows fine-grained control per entity per role
 */
export const granularPermissionSchema = z.object({
  roleId: z.number().int().positive(),
  entityCode: z.string().min(1).max(50),
  canView: z.boolean().default(false),
  canCreate: z.boolean().default(false),
  canEdit: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  allow: z.boolean().default(false),
});

export type GranularPermissionInput = z.infer<typeof granularPermissionSchema>;

export const granularPermissionResponseSchema = z.object({
  id: z.number(),
  roleId: z.number(),
  entityCode: z.string(),
  canView: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  allow: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GranularPermissionResponse = z.infer<
  typeof granularPermissionResponseSchema
>;

/**
 * Get role entity permissions response
 */
export const roleEntityPermissionsSchema = z.record(
  z.string(),
  z.object({
    canView: z.boolean(),
    canCreate: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    allow: z.boolean(),
  }),
);

export type RoleEntityPermissionsResponse = z.infer<
  typeof roleEntityPermissionsSchema
>;
