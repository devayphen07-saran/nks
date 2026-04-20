import { relations } from 'drizzle-orm';
import { idempotencyLog } from './idempotency-log.table';

export const idempotencyLogRelations = relations(idempotencyLog, () => ({}));
