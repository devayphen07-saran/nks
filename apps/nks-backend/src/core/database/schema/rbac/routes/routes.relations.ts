import { relations } from 'drizzle-orm';
import { routes } from './routes.table';
import { roleRouteMapping } from '../../rbac/role-route-mapping/role-route-mapping.table';

export const routesRelations = relations(routes, ({ many }) => ({
  roleMappings: many(roleRouteMapping),
}));
