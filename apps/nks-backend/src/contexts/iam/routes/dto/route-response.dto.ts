import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Base route fields (shared between flat and tree shapes)
const RouteBaseSchema = z.object({
  guuid: z.string().describe('Route public identifier'),
  routePath: z.string().describe('Route path (e.g., /dashboard)'),
  routeName: z.string().describe('Route display name'),
  description: z.string().nullable().describe('Route description'),
  iconName: z.string().nullable().describe('Icon name (lucide icon)'),
  routeType: z
    .enum(['screen', 'sidebar', 'modal', 'tab'])
    .describe('Route type'),
  routeScope: z.enum(['admin', 'store']).describe('Route scope'),
  isPublic: z.boolean().describe('Is public route (no auth required)'),
  isHidden: z.boolean().describe('Hidden from navigation menus but still accessible'),
  parentRouteGuuid: z.string().nullable().describe('Parent route guuid for nesting'),
  fullPath: z.string().describe('Full path including parent paths'),
  sortOrder: z.number().describe('Display order'),
  hasAccess: z.boolean().describe('Entity-level permission check passed for this route'),
});

// Recursive tree schema — children are the same shape
type RouteTreeSchemaType = z.infer<typeof RouteBaseSchema> & {
  children: RouteTreeSchemaType[];
};

const RouteTreeSchema: z.ZodType<RouteTreeSchemaType> = RouteBaseSchema.extend({
  children: z.lazy(() => z.array(RouteTreeSchema)),
});

const UserSummarySchema = z.object({
  guuid: z.string().describe('Public-safe user identifier'),
  firstName: z.string().nullable().describe('User first name'),
  lastName: z.string().nullable().describe('User last name'),
  email: z.string().nullable().describe('User email'),
  primaryRole: z.string().nullable().describe('Primary role code (e.g. SUPER_ADMIN, USER)'),
});

const UserRoutesResponseSchema = z.object({
  user: UserSummarySchema.describe('Authenticated user summary'),
  routes: z
    .array(RouteTreeSchema)
    .describe('Routes the user has access to, as a tree'),
});

const StoreRoutesResponseSchema = z.object({
  user: UserSummarySchema.describe('Authenticated user summary'),
  routes: z
    .array(RouteTreeSchema)
    .describe('Store routes the user has access to, as a tree'),
});

export type RouteTreeDto = RouteTreeSchemaType;
export class UserRoutesResponseDto extends createZodDto(UserRoutesResponseSchema) {}
export class StoreRoutesResponseDto extends createZodDto(StoreRoutesResponseSchema) {}

// Keep old name as alias so other imports don't break during transition
export { UserRoutesResponseDto as AdminRoutesPermissionsResponseDto };
