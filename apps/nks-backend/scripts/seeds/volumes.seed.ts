import type { Db } from './types.js';
import { volumes } from '../../src/core/database/schema';

const data: (typeof volumes.$inferInsert)[] = [
  // Weight
  { volumeName: 'Kilogram',    volumeCode: 'KG',  volumeType: 'weight', decimalPlaces: 3, isSystem: true },
  { volumeName: 'Gram',        volumeCode: 'G',   volumeType: 'weight', decimalPlaces: 0, isSystem: true },
  { volumeName: 'Milligram',   volumeCode: 'MG',  volumeType: 'weight', decimalPlaces: 0, isSystem: true },
  { volumeName: 'Quintal',     volumeCode: 'QTL', volumeType: 'weight', decimalPlaces: 2, isSystem: true },
  { volumeName: 'Tonne',       volumeCode: 'TON', volumeType: 'weight', decimalPlaces: 3, isSystem: true },
  // Volume
  { volumeName: 'Litre',       volumeCode: 'L',   volumeType: 'volume', decimalPlaces: 3, isSystem: true },
  { volumeName: 'Millilitre',  volumeCode: 'ML',  volumeType: 'volume', decimalPlaces: 0, isSystem: true },
  // Length
  { volumeName: 'Metre',       volumeCode: 'M',   volumeType: 'length', decimalPlaces: 2, isSystem: true },
  { volumeName: 'Centimetre',  volumeCode: 'CM',  volumeType: 'length', decimalPlaces: 0, isSystem: true },
  { volumeName: 'Foot',        volumeCode: 'FT',  volumeType: 'length', decimalPlaces: 2, isSystem: true },
  { volumeName: 'Inch',        volumeCode: 'IN',  volumeType: 'length', decimalPlaces: 0, isSystem: true },
  // Count
  { volumeName: 'Piece',       volumeCode: 'PCS', volumeType: 'count',  decimalPlaces: 0, isSystem: true },
  { volumeName: 'Dozen',       volumeCode: 'DZN', volumeType: 'count',  decimalPlaces: 0, isSystem: true },
  { volumeName: 'Box',         volumeCode: 'BOX', volumeType: 'count',  decimalPlaces: 0, isSystem: true },
  { volumeName: 'Packet',      volumeCode: 'PKT', volumeType: 'count',  decimalPlaces: 0, isSystem: true },
  { volumeName: 'Bundle',      volumeCode: 'BDL', volumeType: 'count',  decimalPlaces: 0, isSystem: true },
  // Area
  { volumeName: 'Square Metre', volumeCode: 'SQM', volumeType: 'area', decimalPlaces: 2, isSystem: true },
  { volumeName: 'Square Foot',  volumeCode: 'SQF', volumeType: 'area', decimalPlaces: 2, isSystem: true },
];

export async function seedVolumes(db: Db) {
  return db.insert(volumes).values(data).onConflictDoNothing();
}
