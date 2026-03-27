import { relations } from 'drizzle-orm';
import { roles } from './roles.table';
import { userRoleMapping } from '../user-role-mapping/user-role-mapping.table';
import { rolePermissionMapping } from '../role-permission-mapping/role-permission-mapping.table';
import { roleRouteMapping } from '../role-route-mapping/role-route-mapping.table';

export const rolesRelations = relations(roles, ({ many }) => ({
  userMappings: many(userRoleMapping),
  permissionMappings: many(rolePermissionMapping),
  routeMappings: many(roleRouteMapping),
}));
