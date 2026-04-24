import { Global, Inject, Logger, Module, OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { DATABASE_TOKEN, POOL_TOKEN } from './database.constants';
import { TransactionService } from './transaction.service';

@Global()
@Module({
  providers: [
    {
      provide: POOL_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool => {
        const connectionString = configService.getOrThrow<string>('database.url');
        return new Pool({
          connectionString,
          max: 20,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 2_000,
          application_name: 'nks-backend',
        });
      },
    },
    {
      provide: DATABASE_TOKEN,
      inject: [POOL_TOKEN],
      useFactory: (pool: Pool) => drizzle(pool, { schema }),
    },
    TransactionService,
  ],
  exports: [DATABASE_TOKEN, TransactionService],
})
export class DatabaseModule implements OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(POOL_TOKEN) private readonly pool: Pool) {
    this.pool.on('error', (err: Error) => {
      this.logger.error(`Unexpected pool error: ${err.message}`);
    });
    this.logger.log('Database pool initialised (max=20, idleTimeout=30s, connectTimeout=2s)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    this.logger.log('Database pool closed');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
