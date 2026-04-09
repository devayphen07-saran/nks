import { APIData, APIMethod } from "../api-handler";

// ─── Users Management ───────────────────────────────────────────────────────
// SUPER_ADMIN only endpoints for platform-wide user management.

// 1. List all users with optional search and pagination
export const GET_USERS: APIData = new APIData("users", APIMethod.GET);

// ─── URL Constants (for TanStack Query) ─────────────────────────────────────

export const USER_ENDPOINTS = {
  LIST: "users",
} as const;
