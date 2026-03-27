import { Global, Module, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { DATABASE_TOKEN } from './database.constants';
import { TransactionService } from './transaction.service';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      scope: Scope.DEFAULT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString =
          configService.getOrThrow<string>('database.url');
        const pool = new Pool({ connectionString });
        return drizzle(pool, { schema });
      },
    },
    TransactionService,
  ],
  exports: [DATABASE_TOKEN, TransactionService],
})
export class DatabaseModule {}
