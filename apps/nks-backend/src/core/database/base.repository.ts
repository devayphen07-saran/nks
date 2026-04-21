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

  /**
   * Runs data and count queries in parallel and returns `{ rows, total }`.
   *
   * @example
   * return this.paginate(
   *   this.db.select().from(t).where(where).orderBy(...).limit(pageSize).offset(offset),
   *   this.db.select({ total: count() }).from(t).where(where),
   * );
   */
  protected async paginate<T>(
    dataQuery:  Promise<T[]>,
    countQuery: Promise<{ total: number }[]>,
  ): Promise<{ rows: T[]; total: number }> {
    const [rows, countRows] = await Promise.all([dataQuery, countQuery]);
    return { rows, total: countRows[0]?.total ?? 0 };
  }
}
