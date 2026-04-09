import { relations } from 'drizzle-orm';
import { roles } from './roles.table';
import { roleRouteMapping } from '../../rbac/role-route-mapping/role-route-mapping.table';

export const rolesRelations = relations(roles, ({ many }) => ({
  routeMappings: many(roleRouteMapping),
}));
