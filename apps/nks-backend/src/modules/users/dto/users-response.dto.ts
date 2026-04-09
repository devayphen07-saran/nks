import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

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

export const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

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

export interface UsersListResponse {
  data: { items: UserResponseDto[] };
  message: string;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
