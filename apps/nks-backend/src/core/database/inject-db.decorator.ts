import { Inject } from '@nestjs/common';
import { DATABASE_TOKEN } from './database.constants';

/**
 * Custom decorator to inject the Drizzle database instance.
 * Usage: constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}
 */
export const InjectDb = () => Inject(DATABASE_TOKEN);
