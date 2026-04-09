import type { Db } from './types.js';
import { notificationStatus } from '../../src/core/database/schema/lookups/notification-status';

const data = [
  { code: 'PENDING', label: 'Pending', description: 'Awaiting delivery', isTerminal: false, isError: false, retryable: true, displayOrder: 1 },
  { code: 'SENT', label: 'Sent', description: 'Successfully sent', isTerminal: false, isError: false, retryable: false, displayOrder: 2 },
  { code: 'DELIVERED', label: 'Delivered', description: 'Delivered to device', isTerminal: false, isError: false, retryable: false, displayOrder: 3 },
  { code: 'READ', label: 'Read', description: 'User has read', isTerminal: true, isError: false, retryable: false, displayOrder: 4 },
  { code: 'FAILED', label: 'Failed', description: 'Delivery failed', isTerminal: false, isError: true, retryable: true, displayOrder: 5 },
  { code: 'EXPIRED', label: 'Expired', description: 'Notification expired', isTerminal: true, isError: false, retryable: false, displayOrder: 6 },
];

export async function seedNotificationStatuses(db: Db) {
  return db.insert(notificationStatus).values(data).onConflictDoNothing();
}
