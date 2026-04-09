import { relations } from 'drizzle-orm';
import { notificationStatus } from './notification-status.table';

export const notificationStatusRelations = relations(notificationStatus, () => ({}));
