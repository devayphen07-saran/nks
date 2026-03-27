import { relations } from 'drizzle-orm';
import { userRoleMapping } from './user-role-mapping.table';
import { users } from '../users';
import { roles } from '../roles';
import { store } from '../store';

export const userRoleMappingRelations = relations(
  userRoleMapping,
  ({ one }) => ({
    user: one(users, {
      fields: [userRoleMapping.userFk],
      references: [users.id],
    }),
    role: one(roles, {
      fields: [userRoleMapping.roleFk],
      references: [roles.id],
    }),
    store: one(store, {
      fields: [userRoleMapping.storeFk],
      references: [store.id],
    }),
    assignedByUser: one(users, {
      fields: [userRoleMapping.assignedBy],
      references: [users.id],
      relationName: 'assignedByUser',
    }),
  }),
);
