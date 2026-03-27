import { relations } from 'drizzle-orm';
import { rolePermissionMapping } from './role-permission-mapping.table';
import { roles } from '../roles';
import { permissions } from '../permissions';

export const rolePermissionMappingRelations = relations(
  rolePermissionMapping,
  ({ one }) => ({
    role: one(roles, {
      fields: [rolePermissionMapping.roleFk],
      references: [roles.id],
    }),
    permission: one(permissions, {
      fields: [rolePermissionMapping.permissionFk],
      references: [permissions.id],
    }),
  }),
);
