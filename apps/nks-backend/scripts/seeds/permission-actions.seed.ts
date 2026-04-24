import { permissionAction } from '../../src/core/database/schema/index.js';
import type { Db } from './types.js';

const PERMISSION_ACTIONS = [
  { code: 'VIEW',    displayName: 'View',    description: 'Read access to a resource',          sortOrder: 1 },
  { code: 'CREATE',  displayName: 'Create',  description: 'Create new records',                 sortOrder: 2 },
  { code: 'EDIT',    displayName: 'Edit',    description: 'Modify existing records',             sortOrder: 3 },
  { code: 'DELETE',  displayName: 'Delete',  description: 'Remove records (soft or hard)',       sortOrder: 4 },
  { code: 'EXPORT',  displayName: 'Export',  description: 'Export data to CSV/PDF/Excel',        sortOrder: 5 },
  { code: 'APPROVE', displayName: 'Approve', description: 'Approve or reject workflows',         sortOrder: 6 },
  { code: 'ARCHIVE', displayName: 'Archive', description: 'Move records to archived state',      sortOrder: 7 },
];

export async function seedPermissionActions(db: Db) {
  return db
    .insert(permissionAction)
    .values(PERMISSION_ACTIONS.map((a) => ({
      code:        a.code,
      displayName: a.displayName,
      description: a.description,
      sortOrder:   a.sortOrder,
      isActive:    true,
      isSystem:    true,
    })))
    .onConflictDoNothing();
}
