import type { Db } from '../types.js';

// permission_action table removed — actions are now boolean columns on role_permissions.
export async function seedPermissionActions(_db: Db): Promise<void> {
  // no-op
}
