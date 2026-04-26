import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { searchableSchema } from '../../../../common/dto/pagination.schema';

// ─── Row Types ────────────────────────────────────────────────────────────────

export interface UserRow {
  guuid: string;
  iamUserId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  image: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  createdAt: Date;
  primaryRole: string | null;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export const ListUsersQuerySchema = searchableSchema.extend({
  sortBy: z.enum(['firstName', 'email', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  isActive: z.coerce.boolean().optional(),
});
export class ListUsersQueryDto extends createZodDto(ListUsersQuerySchema) {}

// ─── Response ─────────────────────────────────────────────────────────────────

const UserResponseSchema = z.object({
  guuid: z.string(),
  iamUserId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneNumber: z.string().nullable(),
  phoneNumberVerified: z.boolean(),
  image: z.string().nullable(),
  isBlocked: z.boolean(),
  blockedReason: z.string().nullable(),
  createdAt: z.string(),
  primaryRole: z.string().nullable(),
});

export class UserResponseDto extends createZodDto(UserResponseSchema) {}
