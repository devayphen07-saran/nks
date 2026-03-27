import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ─── Create Role ─────────────────────────────────────────────────────────────
export const CreateRoleSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(30).toUpperCase(),
  description: z.string().max(255).optional(),
  sortOrder: z.number().int().optional(),
  isSystem: z.boolean().optional().default(false),
});
export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}

// ─── Update Role ─────────────────────────────────────────────────────────────
export const UpdateRoleSchema = CreateRoleSchema.partial().omit({ code: true });
export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}

// ─── Assign Role to User ─────────────────────────────────────────────────────
export const AssignRoleSchema = z.object({
  userId: z.number().int().positive(),
  roleId: z.number().int().positive(),
});
export class AssignRoleDto extends createZodDto(AssignRoleSchema) {}

// ─── Assign Permission to Role ────────────────────────────────────────────────
export const AssignPermissionSchema = z.object({
  permissionId: z.number().int().positive(),
});
export class AssignPermissionDto extends createZodDto(AssignPermissionSchema) {}

// ─── Create Permission ───────────────────────────────────────────────────────
export const CreatePermissionSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(100), // e.g. 'users:read', 'company:write'
  resource: z.string().max(50), // e.g. 'users', 'company', 'roles'
  action: z.string().max(20), // e.g. 'read', 'write', 'delete'
  description: z.string().max(255).optional(),
});
export class CreatePermissionDto extends createZodDto(CreatePermissionSchema) {}
