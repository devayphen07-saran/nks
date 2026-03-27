import { relations } from 'drizzle-orm';
import { permissions } from './permissions.table';
import { rolePermissionMapping } from '../role-permission-mapping/role-permission-mapping.table';

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roleMappings: many(rolePermissionMapping),
}));
