import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from './inject-db.decorator';
import * as schema from './schema';
import type { DbTransaction } from './transaction.service';

type Db = NodePgDatabase<typeof schema>;

/**
 * BaseRepository
 *
 * Abstract base for all Drizzle repositories. Provides:
 *   - `protected db` — the main database connection (injected via @InjectDb())
 *   - `conn(tx?)` — returns tx if inside a transaction, otherwise db
 *
 * Subclasses that only need the db connection can omit a constructor entirely;
 * NestJS will resolve the @InjectDb() dependency via the inherited constructor.
 *
 * Subclasses that need additional injectables (TransactionService, etc.) must
 * declare their own constructor and call super(db).
 *
 * @example
 * // Simple repo — no extra deps
 * @Injectable()
 * export class OtpRepository extends BaseRepository {
 *   async findOtp(id: number) {
 *     return this.db.select().from(schema.otpVerification).where(eq(schema.otpVerification.id, id));
 *   }
 * }
 *
 * @example
 * // Repo with additional dep
 * @Injectable()
 * export class SessionsRepository extends BaseRepository {
 *   constructor(
 *     @InjectDb() db: Db,
 *     private readonly txService: TransactionService,
 *   ) { super(db); }
 * }
 */
export abstract class BaseRepository {
  constructor(@InjectDb() protected readonly db: Db) {}

  /**
   * Returns the transaction connection if one is in progress, otherwise the
   * main db. Use this in methods that accept an optional `tx` parameter so
   * they can participate in an outer transaction without changing callers.
   */
  protected conn(tx?: DbTransaction): Db | DbTransaction {
    return tx ?? this.db;
  }

  /** Converts 1-based page + pageSize to a SQL offset. */
  protected static toOffset(page: number, pageSize: number): number {
    return (page - 1) * pageSize;
  }

  /**
   * Fetches a page of rows, skipping the count query when the result is
   * clearly the last page (`rows.length < pageSize`). In that case total is
   * inferred as `offset + rows.length` — exact and free.
   *
   * `countFactory` is only invoked when the full count is needed, so the
   * count query is never executed when browsing past the last page.
   *
   * **Shape contract:** This method intentionally returns the raw DB shape
   * `{ rows, total }`. Services that expose paginated results to controllers
   * must convert this using the `paginated()` factory from
   * `src/common/utils/paginated-result.ts`, which produces `PaginatedResult<T>`
   * (`{ data, meta }`). The TransformInterceptor detects PaginatedResult by
   * checking for `data[]` + `meta.page` + `meta.total` — passing `{ rows, total }`
   * directly would be treated as a plain object, not as a paginated response.
   *
   * @example
   * // In repository:
   * const offset = BaseRepository.toOffset(page, pageSize);
   * return this.paginate(
   *   this.db.select().from(t).where(where).orderBy(...).limit(pageSize).offset(offset),
   *   () => this.db.select({ total: count() }).from(t).where(where),
   *   page, pageSize,
   * );
   *
   * // In service, before returning to controller:
   * const { rows, total } = await this.repo.listUsers(query);
   * return paginated({ items: rows, page: query.page, pageSize: query.pageSize, total });
   */
  protected async paginate<T>(
    dataPromise:  Promise<T[]>,
    countFactory: () => Promise<{ total: number }[]>,
    page: number,
    pageSize: number,
  ): Promise<{ rows: T[]; total: number }> {
    const rows = await dataPromise;
    const offset = (page - 1) * pageSize;
    if (rows.length < pageSize) {
      return { rows, total: offset + rows.length };
    }
    const countRows = await countFactory();
    return { rows, total: countRows[0]?.total ?? 0 };
  }
}
