import { relations } from 'drizzle-orm';
import { roleRouteMapping } from './role-route-mapping.table';
import { roles } from '../../rbac/roles';
import { routes } from '../../rbac/routes';

export const roleRouteMappingRelations = relations(
  roleRouteMapping,
  ({ one }) => ({
    role: one(roles, {
      fields: [roleRouteMapping.roleFk],
      references: [roles.id],
    }),
    route: one(routes, {
      fields: [roleRouteMapping.routeFk],
      references: [routes.id],
    }),
  }),
);
