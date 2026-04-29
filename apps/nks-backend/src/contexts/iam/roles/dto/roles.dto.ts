import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { searchableSchema } from '../../../../common/dto/pagination.schema';

/**
 * NAMING CONVENTION:
 * - DTOs and services use: storeId (semantic, user-facing)
 * - Database schema uses: storeFk (indicates foreign key relationship)
 * - Repository handles conversion between naming conventions
 */

// ─── Create Role ─────────────────────────────────────────────────────────────
// Custom roles are store-scoped. Roles table now ONLY contains store-scoped roles.
// System roles (SUPER_ADMIN, USER, STORE_OWNER) are seeded rows — not created via this DTO.
export const CreateRoleSchema = z.object({
  storeGuuid: z.uuid('Store GUUID is required for all custom roles'),
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
// IMPORTANT — ceiling-check obligation:
// Any new permission field added here MUST also be validated in RolesService.updateRole()
// against the caller's own permissions before being applied. Failing to do so allows
// privilege escalation: a STORE_OWNER could grant themselves permissions they don't hold.
// Strict shape for one entity permission entry — only the 5 known fields.
const EntityPermissionInputSchema = z.object({
  canView:   z.boolean().optional().default(false),
  canCreate: z.boolean().optional().default(false),
  canEdit:   z.boolean().optional().default(false),
  canDelete: z.boolean().optional().default(false),
  deny:      z.boolean().optional().default(false),
});

export const UpdateRoleSchema = CreateRoleSchema.partial().omit({ code: true }).extend({
  entityPermissions: z.record(z.string(), EntityPermissionInputSchema).optional(),
  routePermissions: z.array(z.object({
    routeGuuid: z.uuid(),
    allow: z.boolean().optional(),
  })).optional(),
});
export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}

// ─── Assign Role to User ─────────────────────────────────────────────────────
export const AssignRoleSchema = z.object({
  userGuuid: z.uuid(),
  roleGuuid: z.uuid(),
});
export class AssignRoleDto extends createZodDto(AssignRoleSchema) {}

// ─── List Roles ──────────────────────────────────────────────────────────────
export const ListRolesQuerySchema = searchableSchema.extend({
  sortBy: z.enum(['name', 'code', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  isActive: z.coerce.boolean().optional(),
});
export class ListRolesQueryDto extends createZodDto(ListRolesQuerySchema) {}
