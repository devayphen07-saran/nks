/** Injection token for the Drizzle database instance. */
export const DATABASE_TOKEN = Symbol('DATABASE');

/** Injection token for the raw pg Pool — used for lifecycle management (pool.end() on shutdown). */
export const POOL_TOKEN = Symbol('POOL');
