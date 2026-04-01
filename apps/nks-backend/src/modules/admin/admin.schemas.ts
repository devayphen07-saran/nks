import { z } from 'zod';

// ──── Pagination Schema ────
export const adminPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type AdminPaginationInput = z.infer<typeof adminPaginationSchema>;

// ──── Admin User Schemas ────
export const updateAdminUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isBlocked: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  phoneNumberVerified: z.boolean().optional(),
});

export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;

export const adminUserResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneNumberVerified: z.boolean(),
  isBlocked: z.boolean(),
  loginCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminUserResponse = z.infer<typeof adminUserResponseSchema>;

// ──── Admin Store Schemas ────
export const updateAdminStoreSchema = z.object({
  storeName: z.string().min(1).max(255).optional(),
  registrationNumber: z.string().optional(),
  taxNumber: z.string().optional(),
});

export type UpdateAdminStoreInput = z.infer<typeof updateAdminStoreSchema>;

export const adminStoreResponseSchema = z.object({
  id: z.number(),
  storeCode: z.string(),
  storeName: z.string(),
  storeLegalTypeFk: z.number(),
  storeCategoryFk: z.number(),
  registrationNumber: z.string().nullable(),
  taxNumber: z.string().nullable(),
  isDeleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminStoreResponse = z.infer<typeof adminStoreResponseSchema>;
