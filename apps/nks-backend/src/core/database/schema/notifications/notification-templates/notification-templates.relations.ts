import { relations } from 'drizzle-orm';
import { notificationTemplates } from './notification-templates.table';

export const notificationTemplatesRelations = relations(notificationTemplates, () => ({}));
