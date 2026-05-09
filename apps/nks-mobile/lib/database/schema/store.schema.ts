import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ── stores ─────────────────────────────────────────────────────────────────

export const stores = sqliteTable(
  'stores',
  {
    id:                  integer('id').primaryKey({ autoIncrement: false }),
    guuid:               text('guuid').notNull().unique(),
    name:                text('name').notNull(),
    address:             text('address'),
    phone:               text('phone'),

    replicationStatus:   text('replication_status').notNull().default('pending'),
    replicationError:    text('replication_error'),
    lastReplicatedAt:    integer('last_replicated_at'),
    lastAccessedAt:      integer('last_accessed_at'),
    isDefaultStore:      integer('is_default_store').notNull().default(0),
    isSyncedForOffline:  integer('is_synced_for_offline').notNull().default(0),

    dataFreshnessLimits: text('data_freshness_limits'),   // JSON — per-entity stale thresholds (FIX #4)

    currentState:        text('current_state').default('pending'),   // FIX #9 state machine
    previousState:       text('previous_state'),
    stateTransitionAt:   integer('state_transition_at'),
    stuckSince:          integer('stuck_since'),

    createdAt:           integer('created_at').notNull(),
    updatedAt:           integer('updated_at').notNull().default(0),
  },
  (t) => [
    index('idx_stores_default').on(t.isDefaultStore),
    index('idx_stores_status').on(t.replicationStatus),
  ],
);

export type StoreRow    = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;

// ── store_sync_progress ────────────────────────────────────────────────────

export const storeSyncProgress = sqliteTable(
  'store_sync_progress',
  {
    id:                integer('id').primaryKey({ autoIncrement: true }),
    storeId:           integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    entityType:        text('entity_type').notNull(),

    lastSyncTimestamp: integer('last_sync_timestamp'),  // FIX #2 — replaces cursor
    lastChangeSetId:   text('last_change_set_id'),

    rowsDownloaded:    integer('rows_downloaded').notNull().default(0),
    rowsTotal:         integer('rows_total'),

    cursor:            text('cursor'),          // kept for existing rows; superseded by lastSyncTimestamp
    lastProgressAt:    integer('last_progress_at'),

    status:            text('status').notNull().default('pending'),  // pending|complete|failed
    error:             text('error'),
    updatedAt:         integer('updated_at').notNull().default(0),
  },
  (t) => [
    uniqueIndex('store_sync_progress_unique').on(t.storeId, t.entityType),
  ],
);

export type StoreSyncProgressRow    = typeof storeSyncProgress.$inferSelect;
export type InsertStoreSyncProgress = typeof storeSyncProgress.$inferInsert;

// ── store_data_staging ─────────────────────────────────────────────────────
// FIX #8: all sync data lands here first; committed atomically to live tables.

export const storeDataStaging = sqliteTable(
  'store_data_staging',
  {
    id:              integer('id').primaryKey({ autoIncrement: true }),
    storeId:         integer('store_id').notNull(),
    entityType:      text('entity_type').notNull(),
    entityId:        text('entity_id').notNull(),
    entityData:      text('entity_data').notNull(),  // JSON
    operation:       text('operation').notNull(),     // upsert | delete
    serverTimestamp: integer('server_timestamp'),
    version:         integer('version'),
    createdAt:       integer('created_at').notNull(),
  },
  (t) => [
    index('idx_staging_store_type').on(t.storeId, t.entityType),
  ],
);

export type StoreDataStagingRow    = typeof storeDataStaging.$inferSelect;
export type InsertStoreDataStaging = typeof storeDataStaging.$inferInsert;

// ── sync_metadata ──────────────────────────────────────────────────────────
// FIX #4 (freshness), #9 (config hash), #15 (crash-recovery commit log)

export const syncMetadata = sqliteTable(
  'sync_metadata',
  {
    id:                   integer('id').primaryKey({ autoIncrement: true }),
    storeId:              integer('store_id').notNull().unique().references(() => stores.id, { onDelete: 'cascade' }),

    lastSyncTimestamp:    integer('last_sync_timestamp'),
    recommendedRefreshAt: integer('recommended_refresh_at'),
    requiredRefreshAt:    integer('required_refresh_at'),

    commitLogPhase:       text('commit_log_phase'),   // FIX #15
    commitLogData:        text('commit_log_data'),    // JSON

    configVersion:        integer('config_version'),  // FIX #9
    configHash:           text('config_hash'),
    configFetchedAt:      integer('config_fetched_at'),

    checksumHash:         text('checksum_hash'),
    rowsTotal:            integer('rows_total'),
  },
);

export type SyncMetadataRow    = typeof syncMetadata.$inferSelect;
export type InsertSyncMetadata = typeof syncMetadata.$inferInsert;

// ── store_cache ────────────────────────────────────────────────────────────
// FIX #11: skip full re-sync when switching to a recently-used store.

export const storeCache = sqliteTable(
  'store_cache',
  {
    id:             integer('id').primaryKey({ autoIncrement: true }),
    storeId:        integer('store_id').notNull().unique(),
    storeGuuid:     text('store_guuid').notNull(),
    storeName:      text('store_name').notNull(),
    estimatedSize:  integer('estimated_size'),
    lastAccessedAt: integer('last_accessed_at'),
    expiresAt:      integer('expires_at'),
    isValid:        integer('is_valid').notNull().default(1),
    createdAt:      integer('created_at').notNull(),
  },
);

export type StoreCacheRow    = typeof storeCache.$inferSelect;
export type InsertStoreCache = typeof storeCache.$inferInsert;

// ── roles ──────────────────────────────────────────────────────────────────

export const roles = sqliteTable(
  'roles',
  {
    id:      integer('id').primaryKey({ autoIncrement: true }),
    storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    code:    text('code').notNull(),
    name:    text('name').notNull(),
  },
  (t) => [
    uniqueIndex('roles_store_code_unique').on(t.storeId, t.code),
  ],
);

export type RoleRow    = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

// ── permissions ────────────────────────────────────────────────────────────

export const permissions = sqliteTable(
  'permissions',
  {
    id:         integer('id').primaryKey({ autoIncrement: true }),
    storeId:    integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    code:       text('code').notNull(),
    name:       text('name').notNull(),
    dataScope:  text('data_scope'),   // FIX #6: zone_based | own_only | all | store_only
    scopeField: text('scope_field'),
  },
  (t) => [
    uniqueIndex('permissions_store_code_unique').on(t.storeId, t.code),
  ],
);

export type PermissionRow    = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;

// ── role_permissions ───────────────────────────────────────────────────────

export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    id:             integer('id').primaryKey({ autoIncrement: true }),
    storeId:        integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    roleCode:       text('role_code').notNull(),
    permissionCode: text('permission_code').notNull(),
  },
  (t) => [
    uniqueIndex('role_permissions_unique').on(t.storeId, t.roleCode, t.permissionCode),
  ],
);

export type RolePermissionRow    = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;

// ── user_store_roles ───────────────────────────────────────────────────────

export const userStoreRoles = sqliteTable(
  'user_store_roles',
  {
    id:         integer('id').primaryKey({ autoIncrement: true }),
    userId:     text('user_id').notNull(),
    storeId:    integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    roleCode:   text('role_code').notNull(),
    assignedAt: integer('assigned_at').notNull().default(0),
  },
  (t) => [
    uniqueIndex('user_store_roles_unique').on(t.userId, t.storeId, t.roleCode),
    index('idx_user_store_roles_user_store').on(t.userId, t.storeId),
  ],
);

export type UserStoreRoleRow    = typeof userStoreRoles.$inferSelect;
export type InsertUserStoreRole = typeof userStoreRoles.$inferInsert;

// ── permission_constraints ─────────────────────────────────────────────────
// FIX #3, #6: per-permission business rules validated locally before push.

export const permissionConstraints = sqliteTable(
  'permission_constraints',
  {
    id:              integer('id').primaryKey({ autoIncrement: true }),
    storeId:         integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    permissionCode:  text('permission_code').notNull(),
    constraintType:  text('constraint_type').notNull(),  // fk_check | business_rule | data_scope
    constraintField: text('constraint_field'),
    constraintValue: text('constraint_value'),           // JSON
  },
  (t) => [
    uniqueIndex('perm_constraints_unique').on(t.storeId, t.permissionCode, t.constraintType, t.constraintField),
  ],
);

export type PermissionConstraintRow    = typeof permissionConstraints.$inferSelect;
export type InsertPermissionConstraint = typeof permissionConstraints.$inferInsert;
