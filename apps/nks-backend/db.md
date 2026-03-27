# NKS Database Schema (Consolidated)

All tables follow the **Split Pattern**: `schema/<entity>/<entity>.table.ts`

## 1. Enums

### `enums/enums.ts`
```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const auditActionTypeEnum = pgEnum('audit_action_type', [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'TOKEN_REFRESH',
  'TOKEN_REVOKE',
  'OTP_REQUESTED',
  'OTP_VERIFIED',
  'OTP_FAILED',
]);
```

---

## 2. Core Auth

### `users/users.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, varchar, boolean,
  smallint, text, integer, timestamp, bigint,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id:                    bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:                 uuid('guuid').notNull().unique().defaultRandom(),
  name:                  varchar('name', { length: 255 }).notNull(),
  email:                 varchar('email', { length: 255 }).unique(),
  emailVerified:         boolean('email_verified').notNull().default(false),
  image:                 text('image'),

  // BetterAuth phoneNumber plugin
  phoneNumber:           varchar('phone_number', { length: 20 }).unique(),
  phoneNumberVerified:   boolean('phone_number_verified').notNull().default(false),

  // NKS additionalFields
  kycLevel:              smallint('kyc_level').notNull().default(0),
  languagePreference:    varchar('language_preference', { length: 5 }).notNull().default('en'),
  fcmToken:              text('fcm_token'),
  fcmTokenUpdatedDate:   timestamp('fcm_token_updated_date', { withTimezone: true }),
  whatsappOptedIn:       boolean('whatsapp_opted_in').notNull().default(true),
  isBlocked:             boolean('is_blocked').notNull().default(false),
  blockedReason:         text('blocked_reason'),
  blockedDate:           timestamp('blocked_date', { withTimezone: true }),
  blockedBy:             bigint('blocked_by', { mode: 'number' }).references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  loginCount:            integer('login_count').notNull().default(0),

  // Ayphen audit
  createdBy:             bigint('created_by', { mode: 'number' }).references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  createdDate:           timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:            bigint('modified_by', { mode: 'number' }).references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  modifiedDate:          timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),

  // Soft delete
  isActive:              boolean('is_active').notNull().default(true),
  deletedDate:           timestamp('deleted_date', { withTimezone: true }),
  deletedBy:             bigint('deleted_by', { mode: 'number' }).references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
});

export type User        = typeof users.$inferSelect;
export type NewUser     = typeof users.$inferInsert;
export type UpdateUser  = Partial<Omit<NewUser, 'id'>>;
export type PublicUser  = Omit<User, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy'>;
```

### `users/users.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { users } from './users.table';
import { userSession } from '../user-session/user-session.table';
import { userAuthProvider } from '../user-auth-provider/user-auth-provider.table';
import { userRoleMapping } from '../user-role-mapping/user-role-mapping.table';
import { companyUserMapping } from '../company-user-mapping/company-user-mapping.table';

export const usersRelations = relations(users, ({ many }) => ({
  sessions:      many(userSession),
  authProviders: many(userAuthProvider),
  roleAssignments: many(userRoleMapping),
  companyMemberships: many(companyUserMapping),
}));
```

### `user-session/user-session.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, varchar, boolean, text, timestamp, bigint, index,
} from 'drizzle-orm/pg-core';
import { users } from '../users';

export const userSession = pgTable('user_session', {
  id:           bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:        uuid('guuid').notNull().unique().defaultRandom(),

  // BetterAuth core
  expiresDate:  timestamp('expires_date', { withTimezone: true }).notNull(),
  token:        text('token').notNull().unique(),
  ipAddress:    varchar('ip_address', { length: 50 }),
  userAgent:    text('user_agent'),
  userFk:       bigint('user_fk', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),

  // additionalFields
  deviceId:     varchar('device_id', { length: 100 }),
  deviceName:   varchar('device_name', { length: 100 }),
  deviceType:   varchar('device_type', { length: 20 }),
  appVersion:   varchar('app_version', { length: 20 }),

  // Ayphen audit
  createdBy:    bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:  timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:   bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),
  isActive:     boolean('is_active').notNull().default(true),
  deletedDate:  timestamp('deleted_date', { withTimezone: true }),
  deletedBy:    bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  userIdx: index('user_session_user_idx').on(table.userFk),
}));

export type UserSession       = typeof userSession.$inferSelect;
export type NewUserSession    = typeof userSession.$inferInsert;
export type UpdateUserSession = Partial<Omit<NewUserSession, 'id'>>;
export type PublicUserSession = Omit<UserSession, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy'>;
```

### `user-auth-provider/user-auth-provider.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, text, boolean, timestamp, bigint, index,
} from 'drizzle-orm/pg-core';
import { users } from '../users';

export const userAuthProvider = pgTable('user_auth_provider', {
  id:                       bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:                    uuid('guuid').notNull().unique().defaultRandom(),

  // BetterAuth core (modelName: 'account' → 'user_auth_provider')
  accountId:                text('account_id').notNull(),
  providerId:               text('provider_id').notNull(),
  userFk:                   bigint('user_fk', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken:              text('access_token'),
  refreshToken:             text('refresh_token'),
  idToken:                  text('id_token'),
  accessTokenExpiresDate:   timestamp('access_token_expires_date', { withTimezone: true }),
  refreshTokenExpiresDate:  timestamp('refresh_token_expires_date', { withTimezone: true }),
  scope:                    text('scope'),
  password:                 text('password'),

  // Ayphen audit
  createdBy:    bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:  timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:   bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),
  isActive:     boolean('is_active').notNull().default(true),
  deletedDate:  timestamp('deleted_date', { withTimezone: true }),
  deletedBy:    bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  userIdx: index('user_auth_provider_user_idx').on(table.userFk),
}));

export type UserAuthProvider       = typeof userAuthProvider.$inferSelect;
export type NewUserAuthProvider    = typeof userAuthProvider.$inferInsert;
export type UpdateUserAuthProvider = Partial<Omit<NewUserAuthProvider, 'id'>>;
export type PublicUserAuthProvider = Omit<UserAuthProvider, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy' | 'accessToken' | 'refreshToken' | 'idToken' | 'password'>;
```

### `otp-verification/otp-verification.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, text, boolean, timestamp, bigint, index,
} from 'drizzle-orm/pg-core';
import { users } from '../users';

export const otpVerification = pgTable('otp_verification', {
  id:           bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:        uuid('guuid').notNull().unique().defaultRandom(),

  // BetterAuth core (modelName: 'verification' → 'otp_verification')
  identifier:   text('identifier').notNull(),  // phone or email
  value:        text('value').notNull(),         // OTP code
  expiresDate:  timestamp('expires_date', { withTimezone: true }).notNull(),

  // Ayphen audit
  createdBy:    bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:  timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:   bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),
  isActive:     boolean('is_active').notNull().default(true),
  deletedDate:  timestamp('deleted_date', { withTimezone: true }),
  deletedBy:    bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  createdByIdx: index('otp_verification_created_by_idx').on(table.createdBy),
}));

export type OtpVerification       = typeof otpVerification.$inferSelect;
export type NewOtpVerification    = typeof otpVerification.$inferInsert;
export type UpdateOtpVerification = Partial<Omit<NewOtpVerification, 'id'>>;
export type PublicOtpVerification = Omit<OtpVerification, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy' | 'value'>;
```

---

## 3. RBAC

### `roles/roles.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, varchar, boolean, timestamp, bigint,
} from 'drizzle-orm/pg-core';
import { users } from '../users';
import { company } from '../company';

export const roles = pgTable('roles', {
  id:           bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:        uuid('guuid').notNull().unique().defaultRandom(),
  code:         varchar('code', { length: 30 }).notNull().unique(),
  roleName:     varchar('role_name', { length: 50 }).notNull().unique(),
  description:  varchar('description', { length: 250 }),
  isSystem:     boolean('is_system').notNull().default(false),
  enable:       boolean('enable').notNull().default(true),
  companyFk:    bigint('company_fk', { mode: 'number' }).references(() => company.id, { onDelete: 'restrict' }),

  // Ayphen audit
  createdBy:    bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:  timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:   bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),
  isActive:     boolean('is_active').notNull().default(true),
  deletedDate:  timestamp('deleted_date', { withTimezone: true }),
  deletedBy:    bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
});

export type Role        = typeof roles.$inferSelect;
export type NewRole     = typeof roles.$inferInsert;
export type UpdateRole  = Partial<Omit<NewRole, 'id'>>;
```

### `roles/roles.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { roles } from './roles.table';
import { userRoleMapping } from '../user-role-mapping/user-role-mapping.table';
import { rolePermissionMapping } from '../role-permission-mapping/role-permission-mapping.table';
import { roleRouteMapping } from '../role-route-mapping/role-route-mapping.table';

export const rolesRelations = relations(roles, ({ many }) => ({
  userMappings:       many(userRoleMapping),
  permissionMappings: many(rolePermissionMapping),
  routeMappings:      many(roleRouteMapping),
}));
```

### `permissions/permissions.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, varchar, boolean, text, timestamp, bigint,
} from 'drizzle-orm/pg-core';
import { users } from '../users';

export const permissions = pgTable('permissions', {
  id:           bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:        uuid('guuid').notNull().unique().defaultRandom(),
  name:         varchar('name', { length: 100 }).notNull().unique(),
  code:         varchar('code', { length: 100 }).notNull().unique(),
  resource:     varchar('resource', { length: 50 }).notNull(),
  action:       varchar('action', { length: 20 }).notNull(),
  description:  text('description'),
  isSystem:     boolean('is_system').notNull().default(false),
  enable:       boolean('enable').notNull().default(true),

  // Ayphen audit
  createdBy:    bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:  timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:   bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),
  isActive:     boolean('is_active').notNull().default(true),
  deletedDate:  timestamp('deleted_date', { withTimezone: true }),
  deletedBy:    bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
});

export type Permission       = typeof permissions.$inferSelect;
export type NewPermission    = typeof permissions.$inferInsert;
export type UpdatePermission = Partial<Omit<NewPermission, 'id'>>;
```

### `permissions/permissions.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { permissions } from './permissions.table';
import { rolePermissionMapping } from '../role-permission-mapping/role-permission-mapping.table';

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roleMappings: many(rolePermissionMapping),
}));
```

### `routes/routes.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, varchar, boolean, integer, timestamp, bigint,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { users } from '../users';

export const routes = pgTable('routes', {
  id:             bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:          uuid('guuid').notNull().unique().defaultRandom(),
  parentRouteFk:  bigint('parent_route_fk', { mode: 'number' }).references((): AnyPgColumn => routes.id, { onDelete: 'set null' }),

  routeName:      varchar('route_name', { length: 100 }).notNull(),
  routePath:      varchar('route_path', { length: 200 }).notNull(),
  fullPath:       varchar('full_path', { length: 400 }).notNull().default(''),
  description:    varchar('description', { length: 255 }),
  iconName:       varchar('icon_name', { length: 80 }).notNull(),

  routeType:      varchar('route_type', { length: 20 }).notNull().default('sidebar'),
  appCode:        varchar('app_code', { length: 50 }),

  sortOrder:      integer('sort_order').default(0),
  enable:         boolean('enable').notNull().default(true),
  isHidden:       boolean('is_hidden').notNull().default(false),
  isSystem:       boolean('is_system').notNull().default(false),

  // Ayphen audit
  createdBy:      bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:    timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:     bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate:   timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),
  isActive:       boolean('is_active').notNull().default(true),
  deletedDate:    timestamp('deleted_date', { withTimezone: true }),
  deletedBy:      bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
});

export type Route       = typeof routes.$inferSelect;
export type NewRoute    = typeof routes.$inferInsert;
export type UpdateRoute = Partial<Omit<NewRoute, 'id'>>;
```

### `routes/routes.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { routes } from './routes.table';
import { roleRouteMapping } from '../role-route-mapping/role-route-mapping.table';

export const routesRelations = relations(routes, ({ many }) => ({
  roleMappings: many(roleRouteMapping),
}));
```

### `user-role-mapping/user-role-mapping.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, boolean, timestamp, bigint, unique,
} from 'drizzle-orm/pg-core';
import { users } from '../users';
import { roles } from '../roles';
import { company } from '../company';

export const userRoleMapping = pgTable('user_role_mapping', {
  id:            bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:         uuid('guuid').notNull().unique().defaultRandom(),
  userFk:        bigint('user_fk', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleFk:        bigint('role_fk', { mode: 'number' }).notNull().references(() => roles.id, { onDelete: 'cascade' }),
  companyFk:     bigint('company_fk', { mode: 'number' }).references(() => company.id, { onDelete: 'restrict' }),

  assignedDate:  timestamp('assigned_date', { withTimezone: true }).notNull().defaultNow(),
  assignedBy:    bigint('assigned_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  revokedDate:   timestamp('revoked_date', { withTimezone: true }),
  revokedBy:     bigint('revoked_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),

  // Ayphen audit
  createdBy:    bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:  timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:   bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),
  isActive:     boolean('is_active').notNull().default(true),
  deletedDate:  timestamp('deleted_date', { withTimezone: true }),
  deletedBy:    bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  uniqueIdx: unique('user_role_mapping_unique_idx').on(table.userFk, table.roleFk),
}));

export type UserRoleMapping       = typeof userRoleMapping.$inferSelect;
export type NewUserRoleMapping    = typeof userRoleMapping.$inferInsert;
export type UpdateUserRoleMapping = Partial<Omit<NewUserRoleMapping, 'id'>>;
```

### `role-permission-mapping/role-permission-mapping.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, boolean, timestamp, bigint, unique,
} from 'drizzle-orm/pg-core';
import { roles } from '../roles';
import { permissions } from '../permissions';
import { users } from '../users';
import { company } from '../company';

export const rolePermissionMapping = pgTable('role_permission_mapping', {
  id:            bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:         uuid('guuid').notNull().unique().defaultRandom(),
  roleFk:        bigint('role_fk', { mode: 'number' }).notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionFk:  bigint('permission_fk', { mode: 'number' }).notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  companyFk:     bigint('company_fk', { mode: 'number' }).references(() => company.id, { onDelete: 'restrict' }),

  // Ayphen audit
  createdBy:     bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:   timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:    bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate:  timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),
  isActive:      boolean('is_active').notNull().default(true),
  deletedDate:   timestamp('deleted_date', { withTimezone: true }),
  deletedBy:     bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  uniqueIdx: unique('role_permission_mapping_unique_idx').on(table.roleFk, table.permissionFk),
}));

export type RolePermissionMapping       = typeof rolePermissionMapping.$inferSelect;
export type NewRolePermissionMapping    = typeof rolePermissionMapping.$inferInsert;
export type UpdateRolePermissionMapping = Partial<Omit<NewRolePermissionMapping, 'id'>>;
```

### `role-route-mapping/role-route-mapping.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, boolean, timestamp, bigint, unique,
} from 'drizzle-orm/pg-core';
import { users } from '../users';
import { company } from '../company';
import { roles } from '../roles';
import { routes } from '../routes';

export const roleRouteMapping = pgTable('role_route_mapping', {
  id:           bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:        uuid('guuid').notNull().unique().defaultRandom(),
  roleFk:       bigint('role_fk', { mode: 'number' }).notNull().references(() => roles.id, { onDelete: 'cascade' }),
  routeFk:      bigint('route_fk', { mode: 'number' }).notNull().references(() => routes.id, { onDelete: 'cascade' }),
  companyFk:    bigint('company_fk', { mode: 'number' }).references(() => company.id, { onDelete: 'restrict' }),

  allow:        boolean('allow').notNull().default(true),
  enable:       boolean('enable').notNull().default(true),
  isHidden:     boolean('is_hidden').notNull().default(false),

  // CRUD flags (Ayphen naming)
  canView:      boolean('can_view').notNull().default(true),
  canCreate:    boolean('can_create').notNull().default(false),
  canEdit:      boolean('can_edit').notNull().default(false),
  canDelete:    boolean('can_delete').notNull().default(false),
  canExport:    boolean('can_export').notNull().default(false),

  // Ayphen audit
  createdBy:    bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:  timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:   bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),
  isActive:     boolean('is_active').notNull().default(true),
  deletedDate:  timestamp('deleted_date', { withTimezone: true }),
  deletedBy:    bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  uniqueIdx: unique('role_route_mapping_unique_idx').on(table.roleFk, table.routeFk),
}));

export type RoleRouteMapping       = typeof roleRouteMapping.$inferSelect;
export type NewRoleRouteMapping    = typeof roleRouteMapping.$inferInsert;
export type UpdateRoleRouteMapping = Partial<Omit<NewRoleRouteMapping, 'id'>>;
```

---

## 4. Audit

### `audit-log/audit-log.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, varchar, boolean, text, jsonb, inet, timestamp, bigint,
} from 'drizzle-orm/pg-core';
import { auditActionTypeEnum } from '../enums/enums';
import { users } from '../users';

export const auditLogs = pgTable('audit_logs', {
  id:             bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:          uuid('guuid').notNull().unique().defaultRandom(),
  userFk:         bigint('user_fk', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  phoneNumber:    varchar('phone_number', { length: 20 }),
  action:         auditActionTypeEnum('action').notNull(),
  entityType:     varchar('entity_type', { length: 50 }),
  entityId:       bigint('entity_id', { mode: 'number' }),
  oldValues:      jsonb('old_values'),
  newValues:      jsonb('new_values'),
  meta:           jsonb('meta'),
  ipAddress:      inet('ip_address'),
  userAgent:      text('user_agent'),
  deviceId:       varchar('device_id', { length: 100 }),
  deviceType:     varchar('device_type', { length: 20 }),
  isSuccess:      boolean('is_success').notNull().default(true),
  failureReason:  text('failure_reason'),
  createdDate:    timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  // No modifiedDate — deliberately append-only
});

export type AuditLog    = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
```

---

## 5. Company & Tenant

### `company-type/company-type.table.ts`
```typescript
import { pgTable, bigserial, varchar, text, integer, boolean } from 'drizzle-orm/pg-core';

export const companyType = pgTable('company_type', {
  id:              bigserial('id', { mode: 'number' }).primaryKey(),
  companyTypeName: varchar('company_type_name', { length: 50 }).notNull().unique(), // e.g. 'Pvt Ltd', 'Sole Proprietor'
  companyTypeCode: varchar('company_type_code', { length: 30 }).notNull().unique(), // e.g. 'PVT_LTD', 'SOLE_PROP'
  description:     text('description'),
  sortOrder:       integer('sort_order').notNull().default(0),
  isHidden:        boolean('is_hidden').notNull().default(false),
  isSystem:        boolean('is_system').notNull().default(false),
  isActive:        boolean('is_active').notNull().default(true),
});

export type CompanyType       = typeof companyType.$inferSelect;
export type NewCompanyType    = typeof companyType.$inferInsert;
export type UpdateCompanyType = Partial<Omit<NewCompanyType, 'id'>>;
```

### `company-type/company-type.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { companyType } from './company-type.table';
import { company } from '../company';

export const companyTypeRelations = relations(companyType, ({ many }) => ({
  companies: many(company),
}));
```

### `company/company.table.ts`
```typescript
import { pgTable, bigserial, uuid, varchar, bigint, boolean, timestamp, smallint } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { users } from '../users';
import { companyType } from '../company-type';

export const company = pgTable('company', {
  id:                 bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:              uuid('guuid').notNull().unique().defaultRandom(),

  companyName:        varchar('company_name', { length: 255 }).notNull(),
  companyCode:        varchar('company_code', { length: 50 }).unique(),
  
  companyTypeFk:      bigint('company_type_fk', { mode: 'number' }).notNull().references(() => companyType.id, { onDelete: 'restrict' }),
  
  registrationNumber: varchar('registration_number', { length: 100 }),
  taxNumber:          varchar('tax_number', { length: 100 }), // GST/VAT
  
  kycLevel:           smallint('kyc_level').notNull().default(0),
  isVerified:         boolean('is_verified').notNull().default(false),

  parentCompanyFk:    bigint('parent_company_fk', { mode: 'number' }).references((): AnyPgColumn => company.id, { onDelete: 'restrict' }),

  createdBy:    bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:  timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:   bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),

  // Soft delete
  isActive:    boolean('is_active').notNull().default(true),
  deletedDate: timestamp('deleted_date', { withTimezone: true }),
  deletedBy:   bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
});

export type Company       = typeof company.$inferSelect;
export type NewCompany    = typeof company.$inferInsert;
export type UpdateCompany = Partial<Omit<NewCompany, 'id'>>;
export type PublicCompany = Omit<Company, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy'>;
```

### `company/company.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { company } from './company.table';
import { companyType } from '../company-type';
import { companyUserMapping } from '../company-user-mapping';

export const companyRelations = relations(company, ({ one, many }) => ({
  parent: one(company, {
    fields: [company.parentCompanyFk],
    references: [company.id],
    relationName: 'company_hierarchy',
  }),
  children: many(company, {
    relationName: 'company_hierarchy',
  }),
  companyType: one(companyType, {
    fields: [company.companyTypeFk],
    references: [companyType.id],
  }),
  members: many(companyUserMapping),
}));
```

### `designation/designation.table.ts`
```typescript
import { pgTable, bigserial, varchar, integer, boolean } from 'drizzle-orm/pg-core';

export const designation = pgTable('designation', {
  id:              bigserial('id', { mode: 'number' }).primaryKey(),
  designationName: varchar('designation_name', { length: 100 }).notNull().unique(), // e.g. 'CEO', 'Store Manager'
  designationCode: varchar('designation_code', { length: 50 }).notNull().unique(),  // e.g. 'CEO', 'STORE_MANAGER'
  sortOrder:       integer('sort_order').notNull().default(0),
  isSystem:        boolean('is_system').notNull().default(false),
  isActive:        boolean('is_active').notNull().default(true),
});

export type Designation       = typeof designation.$inferSelect;
export type NewDesignation    = typeof designation.$inferInsert;
export type UpdateDesignation = Partial<Omit<NewDesignation, 'id'>>;
```

### `designation/designation.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { designation } from './designation.table';
import { companyUserMapping } from '../company-user-mapping';

export const designationRelations = relations(designation, ({ many }) => ({
  companyUsers: many(companyUserMapping),
}));
```

### `company-user-mapping/company-user-mapping.table.ts`
```typescript
import { pgTable, bigserial, uuid, bigint, boolean, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { users } from '../users';
import { company } from '../company';
import { designation } from '../designation';

export const companyUserMapping = pgTable('company_user_mapping', {
  id:            bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:         uuid('guuid').notNull().unique().defaultRandom(),

  companyFk:     bigint('company_fk', { mode: 'number' }).notNull().references(() => company.id, { onDelete: 'cascade' }),
  userFk:        bigint('user_fk', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  designationFk: bigint('designation_fk', { mode: 'number' }).references(() => designation.id, { onDelete: 'set null' }),

  isPrimary:     boolean('is_primary').notNull().default(false),
  joinedDate:    timestamp('joined_date', { withTimezone: true }).notNull().defaultNow(),

  // Ayphen audit
  createdBy:    bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:  timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:   bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),

  // Soft delete
  isActive:    boolean('is_active').notNull().default(true),
  deletedDate: timestamp('deleted_date', { withTimezone: true }),
  deletedBy:   bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  uniqueIdx: unique('company_user_mapping_unique_idx').on(table.companyFk, table.userFk),
  userIdx:   index('company_user_mapping_user_idx').on(table.userFk),
}));

export type CompanyUserMapping       = typeof companyUserMapping.$inferSelect;
export type NewCompanyUserMapping    = typeof companyUserMapping.$inferInsert;
export type UpdateCompanyUserMapping = Partial<Omit<NewCompanyUserMapping, 'id'>>;
```

### `company-user-mapping/company-user-mapping.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { companyUserMapping } from './company-user-mapping.table';
import { company } from '../company';
import { users } from '../users';
import { designation } from '../designation';

export const companyUserMappingRelations = relations(companyUserMapping, ({ one }) => ({
  company: one(company, {
    fields: [companyUserMapping.companyFk],
    references: [company.id],
  }),
  user: one(users, {
    fields: [companyUserMapping.userFk],
    references: [users.id],
  }),
  designation: one(designation, {
    fields: [companyUserMapping.designationFk],
    references: [designation.id],
  }),
}));
```

---

## 6. Geography

### `country/country.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, varchar, boolean, char, timestamp, bigint,
} from 'drizzle-orm/pg-core';
import { users } from '../users';

export const country = pgTable('country', {
  id:             bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:          uuid('guuid').notNull().unique().defaultRandom(),

  countryName:    varchar('country_name', { length: 100 }).notNull().unique(),
  countryCode:    char('country_code', { length: 2 }).notNull().unique(),  // ISO 3166-1 alpha-2: IN, US
  isoAlpha3:      char('iso_alpha3', { length: 3 }).unique(),               // IND, USA
  dialCode:       varchar('dial_code', { length: 6 }),                      // +91, +1
  currencyCode:   varchar('currency_code', { length: 3 }),                  // INR, USD
  currencySymbol: varchar('currency_symbol', { length: 5 }),                // ₹, $
  flagEmoji:      varchar('flag_emoji', { length: 10 }),                    // 🇮🇳

  enable:         boolean('enable').notNull().default(true),
  isSystem:       boolean('is_system').notNull().default(false),

  // Ayphen audit
  createdBy:      bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:    timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:     bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate:   timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),
  isActive:       boolean('is_active').notNull().default(true),
});

export type Country       = typeof country.$inferSelect;
export type NewCountry    = typeof country.$inferInsert;
export type UpdateCountry = Partial<Omit<NewCountry, 'id'>>;
```

### `country/country.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { country } from './country.table';
import { stateRegionProvince } from '../state-region-province/state-region-province.table';

export const countryRelations = relations(country, ({ many }) => ({
  states: many(stateRegionProvince),
}));
```

### `state-region-province/state-region-province.table.ts`
```typescript
import { pgTable, bigserial, uuid, varchar, bigint, boolean, timestamp } from 'drizzle-orm/pg-core';
import { country } from '../country';
import { users } from '../users';

export const stateRegionProvince = pgTable('state_region_province', {
  id:          bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:       uuid('guuid').notNull().unique().defaultRandom(),

  stateName:   varchar('state_name', { length: 100 }).notNull(),
  stateCode:   varchar('state_code', { length: 20 }), // e.g. 'KA', 'CA'

  countryFk:   bigint('country_fk', { mode: 'number' }).notNull().references(() => country.id, { onDelete: 'restrict' }),

  // Ayphen audit
  createdBy:    bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:  timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:   bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),

  // Soft delete
  isActive:    boolean('is_active').notNull().default(true),
  deletedDate: timestamp('deleted_date', { withTimezone: true }),
  deletedBy:   bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
});

export type StateRegionProvince       = typeof stateRegionProvince.$inferSelect;
export type NewStateRegionProvince    = typeof stateRegionProvince.$inferInsert;
export type UpdateStateRegionProvince = Partial<Omit<NewStateRegionProvince, 'id'>>;
export type PublicStateRegionProvince = Omit<StateRegionProvince, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy'>;
```

### `state-region-province/state-region-province.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { stateRegionProvince } from './state-region-province.table';
import { country } from '../country';
import { city } from '../city';

export const stateRegionProvinceRelations = relations(stateRegionProvince, ({ one, many }) => ({
  country: one(country, {
    fields: [stateRegionProvince.countryFk],
    references: [country.id],
  }),
  cities: many(city),
}));
```

### `city/city.table.ts`
```typescript
import { pgTable, bigserial, uuid, varchar, bigint, boolean, timestamp } from 'drizzle-orm/pg-core';
import { stateRegionProvince } from '../state-region-province';
import { users } from '../users';

export const city = pgTable('city', {
  id:                    bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:                 uuid('guuid').notNull().unique().defaultRandom(),

  cityName:              varchar('city_name', { length: 100 }).notNull(),
  cityCode:              varchar('city_code', { length: 20 }),

  stateRegionProvinceFk: bigint('state_region_province_fk', { mode: 'number' }).notNull().references(() => stateRegionProvince.id, { onDelete: 'restrict' }),

  // Ayphen audit
  createdBy:    bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:  timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:   bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),

  // Soft delete
  isActive:    boolean('is_active').notNull().default(true),
  deletedDate: timestamp('deleted_date', { withTimezone: true }),
  deletedBy:   bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
});

export type City        = typeof city.$inferSelect;
export type NewCity     = typeof city.$inferInsert;
export type UpdateCity  = Partial<Omit<NewCity, 'id'>>;
export type PublicCity  = Omit<City, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy'>;
```

### `city/city.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { city } from './city.table';
import { stateRegionProvince } from '../state-region-province';

export const cityRelations = relations(city, ({ one }) => ({
  state: one(stateRegionProvince, {
    fields: [city.stateRegionProvinceFk],
    references: [stateRegionProvince.id],
  }),
}));
```

### `county/county.table.ts`
```typescript
import { pgTable, bigserial, uuid, varchar, bigint, boolean, timestamp } from 'drizzle-orm/pg-core';
import { stateRegionProvince } from '../state-region-province';
import { users } from '../users';

export const county = pgTable('county', {
  id:                    bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:                 uuid('guuid').notNull().unique().defaultRandom(),

  countyName:            varchar('county_name', { length: 100 }).notNull(),
  countyCode:            varchar('county_code', { length: 20 }),

  stateRegionProvinceFk: bigint('state_region_province_fk', { mode: 'number' }).notNull().references(() => stateRegionProvince.id, { onDelete: 'restrict' }),

  // Ayphen audit
  createdBy:    bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:  timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:   bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate: timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),

  // Soft delete
  isActive:    boolean('is_active').notNull().default(true),
  deletedDate: timestamp('deleted_date', { withTimezone: true }),
  deletedBy:   bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
});

export type County        = typeof county.$inferSelect;
export type NewCounty     = typeof county.$inferInsert;
export type UpdateCounty  = Partial<Omit<NewCounty, 'id'>>;
export type PublicCounty  = Omit<County, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy'>;
```

### `county/county.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { county } from './county.table';
import { stateRegionProvince } from '../state-region-province';

export const countyRelations = relations(county, ({ one }) => ({
  state: one(stateRegionProvince, {
    fields: [county.stateRegionProvinceFk],
    references: [stateRegionProvince.id],
  }),
}));
```

### `pincode/pincode.table.ts`
```typescript
import { pgTable, bigserial, varchar, bigint, numeric, boolean, index } from 'drizzle-orm/pg-core';
import { city } from '../city';
import { stateRegionProvince } from '../state-region-province';
import { country } from '../country';

export const pincode = pgTable('pincode', {
  id:                    bigserial('id', { mode: 'number' }).primaryKey(),
  postalCode:            varchar('postal_code', { length: 20 }).notNull().unique(),

  cityFk:                bigint('city_fk', { mode: 'number' }).notNull().references(() => city.id, { onDelete: 'restrict' }),
  stateRegionProvinceFk: bigint('state_region_province_fk', { mode: 'number' }).notNull().references(() => stateRegionProvince.id, { onDelete: 'restrict' }),
  countryFk:             bigint('country_fk', { mode: 'number' }).notNull().references(() => country.id, { onDelete: 'restrict' }),

  latitude:              numeric('latitude', { precision: 10, scale: 7 }),
  longitude:             numeric('longitude', { precision: 10, scale: 7 }),

  isActive:              boolean('is_active').notNull().default(true),
}, (table) => ({
  cityIdx:  index('pincode_city_idx').on(table.cityFk),
  stateIdx: index('pincode_state_idx').on(table.stateRegionProvinceFk),
}));

export type Pincode       = typeof pincode.$inferSelect;
export type NewPincode    = typeof pincode.$inferInsert;
export type UpdatePincode = Partial<Omit<NewPincode, 'id'>>;
```

### `pincode/pincode.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { pincode } from './pincode.table';
import { city } from '../city';
import { stateRegionProvince } from '../state-region-province';
import { country } from '../country';

export const pincodeRelations = relations(pincode, ({ one }) => ({
  city: one(city, {
    fields: [pincode.cityFk],
    references: [city.id],
  }),
  state: one(stateRegionProvince, {
    fields: [pincode.stateRegionProvinceFk],
    references: [stateRegionProvince.id],
  }),
  country: one(country, {
    fields: [pincode.countryFk],
    references: [country.id],
  }),
}));
```

---

## 7. Polymorphic System

### `entity/entity.table.ts`
```typescript
import { pgTable, bigserial, varchar, text, integer, boolean } from 'drizzle-orm/pg-core';

export const entity = pgTable('entity', {
  id:          bigserial('id', { mode: 'number' }).primaryKey(),
  entityName:  varchar('entity_name', { length: 100 }).notNull().unique(), // e.g. 'users', 'customers'
  description: text('description'),
  sortOrder:   integer('sort_order').notNull().default(0),
  isHidden:    boolean('is_hidden').notNull().default(false),
  isSystem:    boolean('is_system').notNull().default(false),
  isActive:    boolean('is_active').notNull().default(true),
});

export type Entity       = typeof entity.$inferSelect;
export type NewEntity    = typeof entity.$inferInsert;
export type UpdateEntity = Partial<Omit<NewEntity, 'id'>>;
```

### `entity/entity.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { entity } from './entity.table';
import { address } from '../address';
import { communication } from '../communication';
import { contactPerson } from '../contact-person';
import { notes } from '../notes';

export const entityRelations = relations(entity, ({ many }) => ({
  addresses:       many(address),
  communications:  many(communication),
  contactPersons:  many(contactPerson),
  notes:           many(notes),
}));
```

### `address/address.table.ts`
```typescript
import { pgTable, bigserial, uuid, bigint, varchar, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { entity } from '../entity';
import { users } from '../users';
import { country } from '../country';
import { addressType } from '../address-type';
import { city } from '../city';
import { stateRegionProvince } from '../state-region-province';
import { county } from '../county';

export const address = pgTable('address', {
  id:                      bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:                   uuid('guuid').notNull().unique().defaultRandom(),

  // Polymorphic ownership
  entityFk:                bigint('entity_fk', { mode: 'number' }).notNull().references(() => entity.id, { onDelete: 'restrict' }),
  recordId:                bigint('record_id', { mode: 'number' }).notNull(),

  // Fields
  addressTypeFk:           bigint('address_type_fk', { mode: 'number' }).notNull().references(() => addressType.id, { onDelete: 'restrict' }),
  line1:                   varchar('line1', { length: 255 }).notNull(),
  line2:                   varchar('line2', { length: 255 }),
  cityFk:                  bigint('city_fk', { mode: 'number' }).references(() => city.id, { onDelete: 'restrict' }),
  cityText:                varchar('city_text', { length: 100 }),
  stateRegionProvinceFk:   bigint('state_region_province_fk', { mode: 'number' }).references(() => stateRegionProvince.id, { onDelete: 'restrict' }),
  stateRegionProvinceText: varchar('state_region_province_text', { length: 100 }),
  countyFk:                bigint('county_fk', { mode: 'number' }).references(() => county.id, { onDelete: 'restrict' }),
  countyText:              varchar('county_text', { length: 100 }),
  postalCode:              varchar('postal_code', { length: 20 }),
  countryFk:               bigint('country_fk', { mode: 'number' }).references(() => country.id, { onDelete: 'restrict' }),


  isBillingAddress:        boolean('is_billing_address').notNull().default(false),
  isDefaultAddress:        boolean('is_default_address').notNull().default(false),

  // Audit
  createdBy:               bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:             timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:              bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate:            timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),

  // Soft Delete
  isActive:                boolean('is_active').notNull().default(true),
  deletedDate:             timestamp('deleted_date', { withTimezone: true }),
  deletedBy:               bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  entityRecordIdx: index('address_entity_record_idx').on(table.entityFk, table.recordId),
}));

export type Address       = typeof address.$inferSelect;
export type NewAddress    = typeof address.$inferInsert;
export type UpdateAddress = Partial<Omit<NewAddress, 'id'>>;
export type PublicAddress = Omit<Address, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy'>;
```

### `address/address.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { address } from './address.table';
import { entity } from '../entity';

export const addressRelations = relations(address, ({ one }) => ({
  entity: one(entity, {
    fields: [address.entityFk],
    references: [entity.id],
  }),
}));
```

### `communication/communication.table.ts`
```typescript
import { pgTable, bigserial, uuid, bigint, varchar, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { entity } from '../entity';
import { users } from '../users';
import { communicationType } from '../communication-type';
import { callingCode } from '../calling-code';

export const communication = pgTable('communication', {
  id:                  bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:               uuid('guuid').notNull().unique().defaultRandom(),

  // Polymorphic ownership
  entityFk:            bigint('entity_fk', { mode: 'number' }).notNull().references(() => entity.id, { onDelete: 'restrict' }),
  recordId:            bigint('record_id', { mode: 'number' }).notNull(),

  // Fields
  communicationTypeFk: bigint('communication_type_fk', { mode: 'number' }).notNull().references(() => communicationType.id, { onDelete: 'restrict' }),

  email:               varchar('email', { length: 255 }),
  fax:                 varchar('fax', { length: 50 }),
  phoneNumber:         varchar('phone_number', { length: 20 }),
  callingCodeFk:       bigint('calling_code_fk', { mode: 'number' }).references(() => callingCode.id, { onDelete: 'restrict' }),
  website:             varchar('website', { length: 255 }),

  isVerified:          boolean('is_verified').notNull().default(false),
  isPrimary:           boolean('is_primary').notNull().default(false),

  // Ayphen audit
  createdBy:           bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:         timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:          bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate:        timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),

  // Soft delete
  isActive:            boolean('is_active').notNull().default(true),
  deletedDate:         timestamp('deleted_date', { withTimezone: true }),
  deletedBy:           bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  entityRecordIdx: index('communication_entity_record_idx').on(table.entityFk, table.recordId),
}));

export type Communication       = typeof communication.$inferSelect;
export type NewCommunication    = typeof communication.$inferInsert;
export type UpdateCommunication = Partial<Omit<NewCommunication, 'id'>>;
export type PublicCommunication = Omit<Communication, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy'>;
```

### `communication/communication.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { communication } from './communication.table';
import { entity } from '../entity';

export const communicationRelations = relations(communication, ({ one }) => ({
  entity: one(entity, {
    fields: [communication.entityFk],
    references: [entity.id],
  }),
}));
```

### `contact-person/contact-person.table.ts`
```typescript
import { pgTable, bigserial, uuid, bigint, varchar, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { entity } from '../entity';
import { users } from '../users';
import { contactPersonType } from '../contact-person-type';
import { salutation } from '../salutation';

export const contactPerson = pgTable('contact_person', {
  id:                  bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:               uuid('guuid').notNull().unique().defaultRandom(),

  // Polymorphic ownership
  entityFk:            bigint('entity_fk', { mode: 'number' }).notNull().references(() => entity.id, { onDelete: 'restrict' }),
  recordId:            bigint('record_id', { mode: 'number' }).notNull(),

  // Fields
  contactPersonTypeFk: bigint('contact_person_type_fk', { mode: 'number' }).notNull().references(() => contactPersonType.id, { onDelete: 'restrict' }),

  salutationIdLkFk:    bigint('salutation_id_lk_fk', { mode: 'number' }).references(() => salutation.id, { onDelete: 'restrict' }),
  firstName:           varchar('first_name', { length: 100 }).notNull(),
  lastName:            varchar('last_name', { length: 100 }),
  designationText:     varchar('designation_text', { length: 100 }), // free-text fallback, not FK
  email:               varchar('email', { length: 255 }),
  officeNumber:        varchar('office_number', { length: 20 }),
  mobileNumber:        varchar('mobile_number', { length: 20 }),

  // Ayphen audit
  createdBy:           bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:         timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:          bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate:        timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),

  // Soft delete
  isActive:            boolean('is_active').notNull().default(true),
  deletedDate:         timestamp('deleted_date', { withTimezone: true }),
  deletedBy:           bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  entityRecordIdx: index('contact_person_entity_record_idx').on(table.entityFk, table.recordId),
}));

export type ContactPerson       = typeof contactPerson.$inferSelect;
export type NewContactPerson    = typeof contactPerson.$inferInsert;
export type UpdateContactPerson = Partial<Omit<NewContactPerson, 'id'>>;
export type PublicContactPerson = Omit<ContactPerson, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy'>;
```

### `contact-person/contact-person.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { contactPerson } from './contact-person.table';
import { entity } from '../entity';

export const contactPersonRelations = relations(contactPerson, ({ one }) => ({
  entity: one(entity, {
    fields: [contactPerson.entityFk],
    references: [entity.id],
  }),
}));
```

### `notes/notes.table.ts`
```typescript
import { pgTable, bigserial, uuid, bigint, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { entity } from '../entity';
import { users } from '../users';
import { notesType } from '../notes-type';

export const notes = pgTable('notes', {
  id:          bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:       uuid('guuid').notNull().unique().defaultRandom(),

  // Polymorphic ownership
  entityFk:    bigint('entity_fk', { mode: 'number' }).notNull().references(() => entity.id, { onDelete: 'restrict' }),
  recordId:    bigint('record_id', { mode: 'number' }).notNull(),

  // Fields
  notesTypeFk: bigint('notes_type_fk', { mode: 'number' }).notNull().references(() => notesType.id, { onDelete: 'restrict' }),
  notes:       text('notes').notNull(),

  // Audit
  createdBy:   bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate: timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:  bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate:timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),

  // Soft Delete
  isActive:    boolean('is_active').notNull().default(true),
  deletedDate: timestamp('deleted_date', { withTimezone: true }),
  deletedBy:   bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  entityRecordIdx: index('notes_entity_record_idx').on(table.entityFk, table.recordId),
}));

export type Notes       = typeof notes.$inferSelect;
export type NewNotes    = typeof notes.$inferInsert;
export type UpdateNotes = Partial<Omit<NewNotes, 'id'>>;
export type PublicNotes = Omit<Notes, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy'>;
```

### `notes/notes.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { notes } from './notes.table';
import { entity } from '../entity';

export const notesRelations = relations(notes, ({ one }) => ({
  entity: one(entity, {
    fields: [notes.entityFk],
    references: [entity.id],
  }),
}));
```

---

## 8. Lookup Registries

### `volumes/volumes.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, varchar, boolean, numeric, integer, timestamp, bigint,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { users } from '../users';

export const volumes = pgTable('volumes', {
  id:               bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:            uuid('guuid').notNull().unique().defaultRandom(),

  volumeName:       varchar('volume_name', { length: 50 }).notNull().unique(),   // Kilogram, Litre, Piece
  volumeCode:       varchar('volume_code', { length: 20 }).notNull().unique(),   // KG, L, PCS
  volumeType:       varchar('volume_type', { length: 20 }).notNull(),            // weight | volume | length | count | area
  decimalPlaces:    integer('decimal_places').notNull().default(0),

  // Conversion to base unit
  baseVolumeFk:     bigint('base_volume_fk', { mode: 'number' }).references((): AnyPgColumn => volumes.id, { onDelete: 'restrict' }),
  conversionFactor: numeric('conversion_factor', { precision: 18, scale: 6 }),

  enable:           boolean('enable').notNull().default(true),
  isSystem:         boolean('is_system').notNull().default(false),

  // Ayphen audit
  createdBy:        bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:      timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:       bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate:     timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),

  // Soft delete
  isActive:         boolean('is_active').notNull().default(true),
  deletedDate:      timestamp('deleted_date', { withTimezone: true }),
  deletedBy:        bigint('deleted_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
});

export type Volume       = typeof volumes.$inferSelect;
export type NewVolume    = typeof volumes.$inferInsert;
export type UpdateVolume = Partial<Omit<NewVolume, 'id'>>;
export type PublicVolume = Omit<Volume, 'isActive' | 'deletedDate' | 'deletedBy' | 'createdBy' | 'modifiedBy'>;
```

### `volumes/volumes.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { volumes } from './volumes.table';

export const volumesRelations = relations(volumes, ({ one }) => ({
  baseVolume: one(volumes, {
    fields: [volumes.baseVolumeFk],
    references: [volumes.id],
    relationName: 'volume_conversion',
  }),
}));
```

### `address-type/address-type.table.ts`
```typescript
import { pgTable, bigserial, varchar, text, integer, boolean } from 'drizzle-orm/pg-core';

export const addressType = pgTable('address_type', {
  id:              bigserial('id', { mode: 'number' }).primaryKey(),
  addressTypeName: varchar('address_type_name', { length: 50 }).notNull().unique(), // e.g. 'Home', 'Office', 'Shipping', 'Billing'
  addressTypeCode: varchar('address_type_code', { length: 30 }).notNull().unique(), // e.g. 'HOME', 'OFFICE', 'SHIPPING', 'BILLING'
  description:     text('description'),
  sortOrder:       integer('sort_order').notNull().default(0),
  isHidden:        boolean('is_hidden').notNull().default(false),
  isSystem:        boolean('is_system').notNull().default(false),
  isActive:        boolean('is_active').notNull().default(true),
});

export type AddressType       = typeof addressType.$inferSelect;
export type NewAddressType    = typeof addressType.$inferInsert;
export type UpdateAddressType = Partial<Omit<NewAddressType, 'id'>>;
```

### `address-type/address-type.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { addressType } from './address-type.table';
import { address } from '../address';

export const addressTypeRelations = relations(addressType, ({ many }) => ({
  addresses: many(address),
}));
```

### `communication-type/communication-type.table.ts`
```typescript
import { pgTable, bigserial, varchar, text, integer, boolean } from 'drizzle-orm/pg-core';

export const communicationType = pgTable('communication_type', {
  id:                    bigserial('id', { mode: 'number' }).primaryKey(),
  communicationTypeName: varchar('communication_type_name', { length: 50 }).notNull().unique(), // e.g. 'Mobile', 'Email', 'Fax', 'WhatsApp'
  communicationTypeCode: varchar('communication_type_code', { length: 30 }).notNull().unique(), // e.g. 'MOBILE', 'EMAIL', 'FAX', 'WHATSAPP'
  description:           text('description'),
  sortOrder:             integer('sort_order').notNull().default(0),
  isHidden:              boolean('is_hidden').notNull().default(false),
  isSystem:              boolean('is_system').notNull().default(false),
  isActive:              boolean('is_active').notNull().default(true),
});

export type CommunicationType       = typeof communicationType.$inferSelect;
export type NewCommunicationType    = typeof communicationType.$inferInsert;
export type UpdateCommunicationType = Partial<Omit<NewCommunicationType, 'id'>>;
```

### `communication-type/communication-type.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { communicationType } from './communication-type.table';
import { communication } from '../communication';

export const communicationTypeRelations = relations(communicationType, ({ many }) => ({
  communications: many(communication),
}));
```

### `notes-type/notes-type.table.ts`
```typescript
import { pgTable, bigserial, varchar, text, integer, boolean } from 'drizzle-orm/pg-core';

export const notesType = pgTable('notes_type', {
  id:            bigserial('id', { mode: 'number' }).primaryKey(),
  notesTypeName: varchar('notes_type_name', { length: 50 }).notNull().unique(), // e.g. 'General', 'Feedback', 'Internal', 'Private'
  notesTypeCode: varchar('notes_type_code', { length: 30 }).notNull().unique(), // e.g. 'GENERAL', 'FEEDBACK', 'INTERNAL', 'PRIVATE'
  description:   text('description'),
  sortOrder:     integer('sort_order').notNull().default(0),
  isHidden:      boolean('is_hidden').notNull().default(false),
  isSystem:      boolean('is_system').notNull().default(false),
  isActive:      boolean('is_active').notNull().default(true),
});

export type NotesType       = typeof notesType.$inferSelect;
export type NewNotesType    = typeof notesType.$inferInsert;
export type UpdateNotesType = Partial<Omit<NewNotesType, 'id'>>;
```

### `notes-type/notes-type.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { notesType } from './notes-type.table';
import { notes } from '../notes';

export const notesTypeRelations = relations(notesType, ({ many }) => ({
  notes: many(notes),
}));
```

### `contact-person-type/contact-person-type.table.ts`
```typescript
import {
  pgTable, bigserial, uuid, varchar, boolean, timestamp, bigint,
} from 'drizzle-orm/pg-core';
import { users } from '../users';

export const contactPersonType = pgTable('contact_person_type', {
  id:                    bigserial('id', { mode: 'number' }).primaryKey(),
  guuid:                 uuid('guuid').notNull().unique().defaultRandom(),

  contactPersonTypeName: varchar('contact_person_type_name', { length: 50 }).notNull().unique(),  // Owner, Manager, Accountant
  contactPersonTypeCode: varchar('contact_person_type_code', { length: 30 }).notNull().unique(),  // OWNER, MANAGER, ACCOUNTANT
  description:           varchar('description', { length: 200 }),

  // Whether this type can receive alerts / notifications
  canReceiveAlerts:      boolean('can_receive_alerts').notNull().default(false),

  enable:                boolean('enable').notNull().default(true),
  isSystem:              boolean('is_system').notNull().default(false),

  // Ayphen audit
  createdBy:             bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdDate:           timestamp('created_date', { withTimezone: true }).notNull().defaultNow(),
  modifiedBy:            bigint('modified_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  modifiedDate:          timestamp('modified_date', { withTimezone: true }).$onUpdateFn(() => new Date()),
  isActive:              boolean('is_active').notNull().default(true),
});

export type ContactPersonType       = typeof contactPersonType.$inferSelect;
export type NewContactPersonType    = typeof contactPersonType.$inferInsert;
export type UpdateContactPersonType = Partial<Omit<NewContactPersonType, 'id'>>;
```

### `contact-person-type/contact-person-type.relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { contactPersonType } from './contact-person-type.table';
import { contactPerson } from '../contact-person/contact-person.table';

export const contactPersonTypeRelations = relations(contactPersonType, ({ many }) => ({
  contacts: many(contactPerson),
}));
```

### `salutation/salutation.table.ts`
```typescript
import { pgTable, bigserial, varchar, text, integer, boolean } from 'drizzle-orm/pg-core';

export const salutation = pgTable('salutation', {
  id:             bigserial('id', { mode: 'number' }).primaryKey(),
  salutationText: varchar('salutation_text', { length: 20 }).notNull().unique(), // e.g. 'Mr.', 'Mrs.', 'Dr.', 'Shri'
  description:    text('description'),
  sortOrder:      integer('sort_order').notNull().default(0),
  isHidden:       boolean('is_hidden').notNull().default(false),
  isSystem:       boolean('is_system').notNull().default(false),
  isActive:       boolean('is_active').notNull().default(true),
});

export type Salutation       = typeof salutation.$inferSelect;
export type NewSalutation    = typeof salutation.$inferInsert;
export type UpdateSalutation = Partial<Omit<NewSalutation, 'id'>>;
```

### `calling-code/calling-code.table.ts`
```typescript
import { pgTable, bigserial, varchar, text, integer, boolean } from 'drizzle-orm/pg-core';

export const callingCode = pgTable('calling_code', {
  id:          bigserial('id', { mode: 'number' }).primaryKey(),
  dialCode:    varchar('dial_code', { length: 6 }).notNull().unique(), // e.g. '+91', '+1'
  description: text('description'), // e.g. 'India', 'USA'
  sortOrder:   integer('sort_order').notNull().default(0),
  isHidden:    boolean('is_hidden').notNull().default(false),
  isSystem:    boolean('is_system').notNull().default(false),
  isActive:    boolean('is_active').notNull().default(true),
});

export type CallingCode       = typeof callingCode.$inferSelect;
export type NewCallingCode    = typeof callingCode.$inferInsert;
export type UpdateCallingCode = Partial<Omit<NewCallingCode, 'id'>>;
```

---

