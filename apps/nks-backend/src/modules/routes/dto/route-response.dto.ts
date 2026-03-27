import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RouteResponseSchema = z.object({
  id: z.number().describe('Route ID'),
  routePath: z.string().describe('Route path (e.g., /dashboard)'),
  routeName: z.string().describe('Route display name'),
  description: z.string().nullable().describe('Route description'),
  iconName: z.string().nullable().describe('Icon name (lucide icon)'),
  routeType: z
    .enum(['screen', 'sidebar', 'modal', 'tab'])
    .describe('Route type'),
  appCode: z.string().nullable().describe('App code (null = global)'),
  isPublic: z.boolean().describe('Is public route (no auth required)'),
  parentRouteFk: z.number().nullable().describe('Parent route ID for nesting'),
  fullPath: z.string().describe('Full path including parent paths'),
  sortOrder: z.number().describe('Display order'),
});

const AdminRoutesPermissionsResponseSchema = z.object({
  routes: z.array(RouteResponseSchema).describe('List of admin routes'),
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

export class RouteResponseDto extends createZodDto(RouteResponseSchema) {}

export class AdminRoutesPermissionsResponseDto extends createZodDto(
  AdminRoutesPermissionsResponseSchema,
) {}
