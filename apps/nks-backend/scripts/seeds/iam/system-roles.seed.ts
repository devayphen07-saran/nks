import type { Db } from '../types.js';
import { roles } from '../../../src/core/database/schema/index.js';
import data from './data/system-roles.js';

export async function seedSystemRoles(db: Db): Promise<{ rowCount: number }> {
  const result = await db
    .insert(roles)
    .values(
      data.map((role) => ({
        code:        role.code,
        roleName:    role.roleName,
        description: role.description,
        sortOrder:   role.sortOrder,
        storeFk:     null,
        isSystem:    true,
        isEditable:  false,
        isActive:    true,
      })),
    )
    .onConflictDoNothing();
  return { rowCount: result.rowCount ?? 0 };
}
