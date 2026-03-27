import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../core/database/schema';
import type { DbTransaction } from '../../core/database/transaction.service';

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

/**
 * Nullable — T or null (no undefined).
 */
export type Nullable<T> = T | null;

/**
 * Optional fields — makes all keys optional and nullable.
 */
export type PartialNullable<T> = { [K in keyof T]?: T[K] | null };

/**
 * Pagination — standard offset pagination query params.
 */
export type PageQuery = {
  page: number;
  limit: number;
};

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
