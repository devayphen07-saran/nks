import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../core/database/schema';
import type { DbTransaction } from '../../core/database/transaction.service';
import type { SessionUser } from '../../modules/auth/interfaces/session-user.interface';
import type { Request } from 'express';

// ── Database ────────────────────────────────────────────────────────────────

/**
 * Fully typed Drizzle database instance.
 * Use this instead of importing NodePgDatabase everywhere.
 */
export type Db = NodePgDatabase<typeof schema>;

/**
 * Optional transaction context — passed down from service → repository.
 * Repositories accept `tx?: Tx` and fall back to the injected `db` if absent.
 */
export type Tx = DbTransaction;

// ── Utility Types ───────────────────────────────────────────────────────────

/**
 * Nullable — T or null (no undefined).
 */
export type Nullable<T> = T | null;

/**
 * Optional fields — makes all keys optional and nullable.
 */
export type PartialNullable<T> = { [K in keyof T]?: T[K] | null };

/**
 * ID — numeric primary key type alias for clarity.
 */
export type Id = number;

/**
 * Guuid — string UUID type alias used by BetterAuth.
 * ⚠️ Not a DB primary key — never pass to a repository expecting Id.
 */
export type Guuid = string;

/**
 * ISO date string — used in API responses.
 */
export type ISODateString = string;

// ── Pagination ──────────────────────────────────────────────────────────────

/**
 * Pagination — standard offset pagination query params.
 */
export type PageQuery = {
  page: number;
  limit: number;
};

/**
 * Standard paginated response shape.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Request Types ───────────────────────────────────────────────────────────

/**
 * Express Request extended with authenticated user — after AuthGuard.
 */
export interface AuthenticatedRequest extends Request {
  user: SessionUser;
}

// ── Entity Contracts ────────────────────────────────────────────────────────

/**
 * Soft-deletable entity fields shared by BaseEntity.
 */
export interface SoftDeletable {
  isActive: boolean;
  deletedDate: Date | null;
  deletedBy: number | null;
}

/**
 * Minimal repository interface contract.
 */
export interface IRepository<
  T,
  CreateDto = Partial<T>,
  UpdateDto = Partial<T>,
> {
  findById(id: number): Promise<T | null>;
  findAll?(): Promise<T[]>;
  create?(data: CreateDto): Promise<T>;
  update?(id: number, data: UpdateDto): Promise<T | null>;
}
