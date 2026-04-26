import type { Db } from '../types.js';
import { permissionAction } from '../../../src/core/database/schema/index.js';
import data from './data/permission-actions.js';

export async function seedPermissionActions(db: Db) {
  return db
    .insert(permissionAction)
    .values(data.map((a) => ({ ...a, isActive: true, isSystem: true })))
    .onConflictDoNothing();
}
