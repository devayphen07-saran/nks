import { relations } from 'drizzle-orm';
import { storeUserMapping } from './store-user-mapping.table';
import { store } from '../../store/store';
import { users } from '../../auth/users';
import { designationType } from '../../lookups/designation-type/designation-type.table';

export const storeUserMappingRelations = relations(
  storeUserMapping,
  ({ one }) => ({
    store: one(store, {
      fields: [storeUserMapping.storeFk],
      references: [store.id],
    }),
    user: one(users, {
      fields: [storeUserMapping.userFk],
      references: [users.id],
    }),
    assignedByUser: one(users, {
      fields: [storeUserMapping.assignedBy],
      references: [users.id],
      relationName: 'assignedByUser',
    }),
    modifiedByUser: one(users, {
      fields: [storeUserMapping.modifiedBy],
      references: [users.id],
      relationName: 'storeUserModifiedBy',
    }),
    deletedByUser: one(users, {
      fields: [storeUserMapping.deletedBy],
      references: [users.id],
      relationName: 'storeUserDeletedBy',
    }),
    designation: one(designationType, {
      fields: [storeUserMapping.designationFk],
      references: [designationType.id],
      relationName: 'designation',
    }),
  }),
);
