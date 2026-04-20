import { relations } from 'drizzle-orm';
import { notifications } from './notifications.table';

export const notificationsRelations = relations(notifications, () => ({}));
