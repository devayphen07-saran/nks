import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * NAMING CONVENTION:
 * - DTOs and services use: storeId (semantic, user-facing)
 * - Database schema uses: storeFk (indicates foreign key relationship)
 * - Repository handles conversion between naming conventions
 */

// ─── Create Role ─────────────────────────────────────────────────────────────
// Custom roles are store-scoped. Roles table now ONLY contains store-scoped roles.
// System roles (SUPER_ADMIN, USER, STORE_OWNER, STAFF) are defined as enums, not here.
export const CreateRoleSchema = z.object({
  storeId: z.number().int().positive('Store ID is required for all custom roles'),
  name: z.string().min(2).max(100),
  code: z
    .string()
    .min(2)
    .max(30)
    .toUpperCase()
    .refine((v) => /^[A-Z0-9_]+$/.test(v), {
      message: 'Role code may only contain uppercase letters, numbers, and underscores',
    }),
  description: z.string().max(255).optional(),
  sortOrder: z.number().int().optional(),
});
export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}

// ─── Update Role ─────────────────────────────────────────────────────────────
export const UpdateRoleSchema = CreateRoleSchema.partial().omit({ code: true }).extend({
  entityPermissions: z.record(z.string(), z.record(z.string(), z.boolean())).optional(),
  routePermissions: z.array(z.object({
    routeId: z.number(),
    canView: z.boolean().optional(),
    canCreate: z.boolean().optional(),
    canEdit: z.boolean().optional(),
    canDelete: z.boolean().optional(),
    canExport: z.boolean().optional(),
  })).optional(),
});
export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}

// ─── Assign Role to User ─────────────────────────────────────────────────────
export const AssignRoleSchema = z.object({
  userId: z.number().int().positive(),
  roleId: z.number().int().positive(),
});
export class AssignRoleDto extends createZodDto(AssignRoleSchema) {}
