import { roles } from '../../src/core/database/schema/index.js';
import type { Db } from './types.js';

export interface SystemRoleSeed {
  code: string;
  roleName: string;
  description: string;
  sortOrder: number;
}

export const SYSTEM_ROLES: SystemRoleSeed[] = [
  {
    code: 'SUPER_ADMIN',
    roleName: 'Super Admin',
    description: 'Platform-wide administrator. Full access.',
    sortOrder: 1,
  },
  {
    code: 'USER',
    roleName: 'User',
    description: 'Default platform user.',
    sortOrder: 2,
  },
  {
    code: 'STORE_OWNER',
    roleName: 'Store Owner',
    description: 'Full access to their store.',
    sortOrder: 3,
  },
];

export async function seedSystemRoles(db: Db): Promise<void> {
  for (const role of SYSTEM_ROLES) {
    await db
      .insert(roles)
      .values({
        code: role.code,
        roleName: role.roleName,
        description: role.description,
        sortOrder: role.sortOrder,
        storeFk: null,
        isSystem: true,
        isEditable: false,
        isActive: true,
      })
      .onConflictDoNothing();
  }
}
