import type { SessionUser } from '../../modules/auth/interfaces/session-user.interface';
import type { Request } from 'express';

/**
 * Pagination parameters passed via query string.
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

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

/**
 * Minimal repository interface contract.
 * All repositories should implement at minimum these read methods.
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

/**
 * Express Request extended with authenticated user — after AuthGuard.
 * Re-exported here for backward compatibility.
 */
export interface AuthenticatedRequest extends Request {
  user: SessionUser;
}

/**
 * Soft-deletable entity fields shared by BaseEntity.
 */
export interface SoftDeletable {
  isActive: boolean;
  deletedDate: Date | null;
  deletedBy: number | null;
}
