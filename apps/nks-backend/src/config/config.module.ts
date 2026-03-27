import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import msg91Config from './msg91.config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available globally
      cache: true, // Performance: caches ENV reads
      load: [appConfig, databaseConfig, msg91Config],
      // Expandable later for Joi / class-validator validation Schema
    }),
  ],
})
export class ConfigModule {}
