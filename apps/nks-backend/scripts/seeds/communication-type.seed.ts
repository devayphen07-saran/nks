import type { Db } from './types';
import { communicationType } from '../../src/core/database/schema';

const data = [
  { communicationTypeName: 'Mobile',   communicationTypeCode: 'MOBILE',   sortOrder: 1, isSystem: true },
  { communicationTypeName: 'Email',    communicationTypeCode: 'EMAIL',    sortOrder: 2, isSystem: true },
  { communicationTypeName: 'WhatsApp', communicationTypeCode: 'WHATSAPP', sortOrder: 3, isSystem: true },
  { communicationTypeName: 'Landline', communicationTypeCode: 'LANDLINE', sortOrder: 4, isSystem: true },
  { communicationTypeName: 'Fax',      communicationTypeCode: 'FAX',      sortOrder: 5, isSystem: true },
];

export async function seedCommunicationTypes(db: Db) {
  return db.insert(communicationType).values(data).onConflictDoNothing();
}
