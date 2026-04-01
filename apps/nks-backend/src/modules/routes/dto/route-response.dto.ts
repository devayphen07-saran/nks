import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Base route fields (shared between flat and tree shapes)
const RouteBaseSchema = z.object({
  id: z.number().describe('Route ID'),
  routePath: z.string().describe('Route path (e.g., /dashboard)'),
  routeName: z.string().describe('Route display name'),
  description: z.string().nullable().describe('Route description'),
  iconName: z.string().nullable().describe('Icon name (lucide icon)'),
  routeType: z
    .enum(['screen', 'sidebar', 'modal', 'tab'])
    .describe('Route type'),
  appCode: z.string().nullable().describe('App code (null = store routes)'),
  isPublic: z.boolean().describe('Is public route (no auth required)'),
  parentRouteFk: z.number().nullable().describe('Parent route ID for nesting'),
  fullPath: z.string().describe('Full path including parent paths'),
  sortOrder: z.number().describe('Display order'),
  hasAccess: z
    .boolean()
    .describe('Whether the current user/role can access this route'),
  canView: z.boolean().describe('Can view this route'),
  canCreate: z.boolean().describe('Can create within this route'),
  canEdit: z.boolean().describe('Can edit within this route'),
  canDelete: z.boolean().describe('Can delete within this route'),
  canExport: z.boolean().describe('Can export within this route'),
});

// Recursive tree schema — children are the same shape
type RouteTreeSchemaType = z.infer<typeof RouteBaseSchema> & {
  children: RouteTreeSchemaType[];
};

const RouteTreeSchema: z.ZodType<RouteTreeSchemaType> = RouteBaseSchema.extend({
  children: z.lazy(() => z.array(RouteTreeSchema)),
});

const AdminRoutesPermissionsResponseSchema = z.object({
  routes: z
    .array(RouteTreeSchema)
    .describe('All routes as a tree with hasAccess per node'),
  permissions: z
    .array(
      z.object({
        id: z.number().describe('Permission ID'),
        code: z.string().describe('Permission code (e.g., users.view)'),
        name: z.string().describe('Permission name'),
        resource: z.string().describe('Resource (e.g., users)'),
        action: z.string().describe('Action (e.g., view)'),
        description: z.string().nullable().describe('Permission description'),
      }),
    )
    .describe('List of permissions'),
});

const StoreRoutesResponseSchema = z.object({
  routes: z
    .array(RouteTreeSchema)
    .describe('All store routes as a tree with hasAccess per node'),
  permissions: z
    .array(
      z.object({
        id: z.number().describe('Permission ID'),
        code: z.string().describe('Permission code'),
        name: z.string().describe('Permission name'),
        resource: z.string().describe('Resource'),
        action: z.string().describe('Action'),
        description: z.string().nullable(),
      }),
    )
    .describe('Permission codes granted to this user in the active store'),
});

export type RouteTreeDto = RouteTreeSchemaType;
export class AdminRoutesPermissionsResponseDto extends createZodDto(
  AdminRoutesPermissionsResponseSchema,
) {}
export class StoreRoutesResponseDto extends createZodDto(
  StoreRoutesResponseSchema,
) {}
