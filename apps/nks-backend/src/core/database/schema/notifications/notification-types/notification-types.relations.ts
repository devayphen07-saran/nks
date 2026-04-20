import { relations } from 'drizzle-orm';
import { notificationTypes } from './notification-types.table';

export const notificationTypesRelations = relations(notificationTypes, () => ({}));
