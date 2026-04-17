import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { createLogger } from '../../utils/logger';
import { MIGRATION_TIMEOUT_MS } from './constants';
import migrationFiles from '../../../drizzle/migrations';

const log = createLogger('DatabaseMigrations');

/**
 * Runs all pending Drizzle migrations.
 * Migration state is tracked in __drizzle_migrations — safe to call on every startup.
 * A timeout guard prevents a stuck migration from freezing app startup indefinitely.
 */
export async function runMigrations(
  db: ExpoSQLiteDatabase<Record<string, unknown>>,
): Promise<void> {
  await Promise.race([
    migrate(db, migrationFiles),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(`Migration timed out after ${MIGRATION_TIMEOUT_MS}ms`),
          ),
        MIGRATION_TIMEOUT_MS,
      ),
    ),
  ]);
  log.info('Migrations applied');
}
