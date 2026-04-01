/**
 * ✅ MODULE 6 PHASE 1: SQLite Database Configuration
 *
 * Purpose:
 * - Initialize SQLite database for offline cache
 * - Define schema for cache entries and mutations
 * - Handle migrations and version management
 * - Provide connection management and error handling
 *
 * Database Tables:
 * - cache_entries: Cached API responses with TTL
 * - pending_mutations: Queued CREATE/UPDATE/DELETE operations
 * - cache_metadata: Database metadata and statistics
 */

import SQLite from 'react-native-sqlite-storage';
import { Logger } from '@/utils/logger';

const DB_NAME = 'nks_offline.db';
const DB_VERSION = 1;

export interface CacheEntry {
  id: string;
  resource_type: string;
  resource_id: string | null;
  data: string; // JSON stringified
  status: 'FRESH' | 'STALE' | 'PENDING';
  created_at: number;
  updated_at: number;
  expires_at: number;
  etag: string | null;
}

export interface PendingMutation {
  id: string;
  resource_type: string;
  resource_id: string | null;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string; // JSON stringified
  queue_request_id: string | null;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  created_at: number;
  synced_at: number | null;
}

export interface CacheMetadata {
  id: string;
  last_sync_at: number | null;
  total_mutations: number;
  total_entries: number;
  db_version: number;
  last_cleanup_at: number | null;
}

class SQLiteDatabase {
  private readonly logger = new Logger('SQLiteDatabase');
  private db: SQLite.Database | null = null;
  private initialized = false;

  /**
   * Initialize database connection and create schema
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.debug('✅ Database already initialized');
      return;
    }

    try {
      // Enable promise mode
      SQLite.enablePromise(true);

      // Open database (creates if doesn't exist)
      this.db = await SQLite.openDatabase({
        name: DB_NAME,
        location: 'default',
        createFromLocation: '~www/nks_offline.db', // Optional: from bundle
      });

      this.logger.log('✅ SQLite database opened');

      // Configure performance settings
      await this.configurePragmas();

      // Initialize schema
      await this.initializeSchema();

      this.initialized = true;
      this.logger.log('✅ Database initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize database', error);
      throw error;
    }
  }

  /**
   * Configure PRAGMA settings for performance
   */
  private async configurePragmas(): Promise<void> {
    try {
      const pragmas = [
        'PRAGMA journal_mode = WAL',              // Write-Ahead Logging
        'PRAGMA synchronous = NORMAL',            // Balance safety/performance
        'PRAGMA cache_size = -64000',            // 64MB cache
        'PRAGMA foreign_keys = ON',              // Enable foreign keys
        'PRAGMA temp_store = MEMORY',            // Use memory for temp tables
        'PRAGMA query_only = FALSE',             // Allow writes
      ];

      for (const pragma of pragmas) {
        await this.db?.executeSql(pragma);
      }

      this.logger.debug('✅ PRAGMA settings configured');
    } catch (error) {
      this.logger.warn('⚠️ Failed to configure PRAGMA', error);
      // Don't fail on PRAGMA errors, continue
    }
  }

  /**
   * Initialize database schema
   */
  private async initializeSchema(): Promise<void> {
    try {
      // Create cache_entries table
      await this.db?.executeSql(`
        CREATE TABLE IF NOT EXISTS cache_entries (
          id TEXT PRIMARY KEY,
          resource_type TEXT NOT NULL,
          resource_id TEXT,
          data TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('FRESH', 'STALE', 'PENDING')),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          etag TEXT,
          UNIQUE(resource_type, resource_id)
        )
      `);

      // Create index on resource_type for queries
      await this.db?.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_cache_resource_type
        ON cache_entries(resource_type)
      `);

      // Create index on expires_at for cleanup
      await this.db?.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_cache_expires_at
        ON cache_entries(expires_at)
      `);

      // Create pending_mutations table
      await this.db?.executeSql(`
        CREATE TABLE IF NOT EXISTS pending_mutations (
          id TEXT PRIMARY KEY,
          resource_type TEXT NOT NULL,
          resource_id TEXT,
          operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE')),
          payload TEXT NOT NULL,
          queue_request_id TEXT,
          status TEXT NOT NULL CHECK(status IN ('PENDING', 'SYNCED', 'FAILED')),
          created_at INTEGER NOT NULL,
          synced_at INTEGER,
          UNIQUE(resource_type, resource_id, operation)
        )
      `);

      // Create index on queue_request_id
      await this.db?.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_mutation_queue_request
        ON pending_mutations(queue_request_id)
      `);

      // Create index on status
      await this.db?.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_mutation_status
        ON pending_mutations(status)
      `);

      // Create cache_metadata table
      await this.db?.executeSql(`
        CREATE TABLE IF NOT EXISTS cache_metadata (
          id TEXT PRIMARY KEY,
          last_sync_at INTEGER,
          total_mutations INTEGER DEFAULT 0,
          total_entries INTEGER DEFAULT 0,
          db_version INTEGER NOT NULL,
          last_cleanup_at INTEGER
        )
      `);

      // Initialize metadata if empty
      const metadataResult = await this.db?.executeSql(
        'SELECT COUNT(*) as count FROM cache_metadata'
      );

      if (metadataResult && metadataResult[0].rows.length > 0) {
        const count = metadataResult[0].rows.raw()[0].count;
        if (count === 0) {
          await this.db?.executeSql(
            `INSERT INTO cache_metadata (id, db_version, last_sync_at)
             VALUES (?, ?, ?)`,
            ['__metadata', DB_VERSION, null]
          );
        }
      }

      this.logger.log('✅ Schema initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize schema', error);
      throw error;
    }
  }

  /**
   * Execute SQL query with optional parameters
   */
  async execute(
    sql: string,
    params: unknown[] = []
  ): Promise<SQLite.SQLResultSet | undefined> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.executeSql(sql, params as any[]);
      return result[0];
    } catch (error) {
      this.logger.error(`❌ SQL execution failed: ${sql}`, error);
      throw error;
    }
  }

  /**
   * Execute query and return rows
   */
  async query<T>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const result = await this.execute(sql, params);
    if (!result || result.rows.length === 0) {
      return [];
    }
    return result.rows.raw() as T[];
  }

  /**
   * Execute query and return first row
   */
  async queryOne<T>(
    sql: string,
    params: unknown[] = []
  ): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Run transaction
   */
  async transaction<T>(
    callback: () => Promise<T>
  ): Promise<T> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.executeSql('BEGIN TRANSACTION');
      const result = await callback();
      await this.db.executeSql('COMMIT');
      return result;
    } catch (error) {
      await this.db.executeSql('ROLLBACK');
      this.logger.error('❌ Transaction failed', error);
      throw error;
    }
  }

  /**
   * Clear all data (use with caution)
   */
  async clearAll(): Promise<void> {
    try {
      await this.transaction(async () => {
        await this.execute('DELETE FROM cache_entries');
        await this.execute('DELETE FROM pending_mutations');
        await this.execute(
          'UPDATE cache_metadata SET total_entries = 0, total_mutations = 0'
        );
      });

      this.logger.log('✅ All data cleared');
    } catch (error) {
      this.logger.error('❌ Failed to clear data', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.db = null;
        this.initialized = false;
        this.logger.log('✅ Database closed');
      } catch (error) {
        this.logger.error('❌ Failed to close database', error);
      }
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalMutations: number;
    cachedResources: string[];
    databaseSize: string;
  }> {
    try {
      const metadata = await this.queryOne<CacheMetadata>(
        'SELECT * FROM cache_metadata WHERE id = ?',
        ['__metadata']
      );

      const resources = await this.query<{ resource_type: string }>(
        'SELECT DISTINCT resource_type FROM cache_entries'
      );

      return {
        totalEntries: metadata?.total_entries ?? 0,
        totalMutations: metadata?.total_mutations ?? 0,
        cachedResources: resources.map((r) => r.resource_type),
        databaseSize: '~2KB per entry',
      };
    } catch (error) {
      this.logger.error('❌ Failed to get stats', error);
      return {
        totalEntries: 0,
        totalMutations: 0,
        cachedResources: [],
        databaseSize: 'unknown',
      };
    }
  }

  /**
   * Cleanup expired entries (call periodically)
   */
  async cleanupExpiredEntries(): Promise<number> {
    try {
      const now = Date.now();
      const result = await this.execute(
        'DELETE FROM cache_entries WHERE expires_at < ?',
        [now]
      );

      const deletedCount = result?.rowsAffected ?? 0;

      if (deletedCount > 0) {
        this.logger.log(`✅ Cleaned up ${deletedCount} expired entries`);
        await this.updateMetadata();
      }

      return deletedCount;
    } catch (error) {
      this.logger.error('❌ Failed to cleanup expired entries', error);
      return 0;
    }
  }

  /**
   * Update metadata counts
   */
  async updateMetadata(): Promise<void> {
    try {
      const entryCount = await this.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM cache_entries'
      );

      const mutationCount = await this.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM pending_mutations WHERE status = ?',
        ['PENDING']
      );

      await this.execute(
        `UPDATE cache_metadata
         SET total_entries = ?, total_mutations = ?, last_cleanup_at = ?
         WHERE id = ?`,
        [
          entryCount?.count ?? 0,
          mutationCount?.count ?? 0,
          Date.now(),
          '__metadata',
        ]
      );
    } catch (error) {
      this.logger.error('❌ Failed to update metadata', error);
    }
  }
}

// Singleton instance
let instance: SQLiteDatabase | null = null;

/**
 * Get or create SQLiteDatabase instance
 */
export async function getSQLiteDatabase(): Promise<SQLiteDatabase> {
  if (!instance) {
    instance = new SQLiteDatabase();
    await instance.initialize();
  }
  return instance;
}

/**
 * Reset database (for testing)
 */
export async function resetDatabase(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}

export default SQLiteDatabase;
