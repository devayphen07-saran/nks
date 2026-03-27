import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../src/core/database/schema';

export type Db = NodePgDatabase<typeof schema>;
