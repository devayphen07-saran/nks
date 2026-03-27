import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ─── Create Invite ───────────────────────────────────────────────────────────

const InviteStaffSchema = z.object({
  inviteeEmail: z.string().email(),
  roleCode: z.string().min(1), // e.g. 'STORE_MANAGER', 'CASHIER'
  permissionIds: z.array(z.number().int().positive()), // permission PKs to grant
});

export class InviteStaffDto extends createZodDto(InviteStaffSchema) {}

// ─── Accept Invite ───────────────────────────────────────────────────────────

const AcceptInviteSchema = z.object({
  token: z.string().min(1),
});

export class AcceptInviteDto extends createZodDto(AcceptInviteSchema) {}

// ─── Update Staff Permissions ────────────────────────────────────────────────

const UpdateStaffPermissionsSchema = z.object({
  permissionIds: z.array(z.number().int().positive()),
});

export class UpdateStaffPermissionsDto extends createZodDto(
  UpdateStaffPermissionsSchema,
) {}
