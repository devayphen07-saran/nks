import { relations } from 'drizzle-orm';
import { roleEntityPermission } from './role-entity-permission.table';
import { roles } from '../../rbac/roles';

export const roleEntityPermissionRelations = relations(
  roleEntityPermission,
  ({ one }) => ({
    role: one(roles, {
      fields: [roleEntityPermission.roleFk],
      references: [roles.id],
    }),
  }),
);
