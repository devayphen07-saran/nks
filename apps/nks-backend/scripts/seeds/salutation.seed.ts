import type { Db } from './types.js';
import { salutation } from '../../src/core/database/schema';

const data = [
  { salutationText: 'Mr.',   sortOrder: 1, isSystem: true },
  { salutationText: 'Mrs.',  sortOrder: 2, isSystem: true },
  { salutationText: 'Ms.',   sortOrder: 3, isSystem: true },
  { salutationText: 'Dr.',   sortOrder: 4, isSystem: true },
  { salutationText: 'Shri',  sortOrder: 5, isSystem: true },
  { salutationText: 'Smt.',  sortOrder: 6, isSystem: true },
];

export async function seedSalutations(db: Db) {
  return db.insert(salutation).values(data).onConflictDoNothing();
}
