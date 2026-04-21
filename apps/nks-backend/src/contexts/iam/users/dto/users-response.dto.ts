import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { searchableSchema } from '../../../../common/dto/pagination.schema';

// ─── Row Types ────────────────────────────────────────────────────────────────

export interface UserRow {
  guuid: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  image: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  primaryLoginMethod: string | null;
  loginCount: number;
  lastLoginAt: Date | null;
  profileCompleted: boolean;
  isActive: boolean;
  createdAt: Date;
  primaryRole: string | null;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export const ListUsersQuerySchema = searchableSchema;
export class ListUsersQueryDto extends createZodDto(ListUsersQuerySchema) {}

// ─── Response ─────────────────────────────────────────────────────────────────

const UserResponseSchema = z.object({
  guuid: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneNumber: z.string().nullable(),
  phoneNumberVerified: z.boolean(),
  image: z.string().nullable(),
  isBlocked: z.boolean(),
  blockedReason: z.string().nullable(),
  primaryLoginMethod: z.string().nullable(),
  loginCount: z.number(),
  lastLoginAt: z.string().nullable(),
  profileCompleted: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  primaryRole: z.string().nullable(),
});

export class UserResponseDto extends createZodDto(UserResponseSchema) {}
