// ─────────────────────────────────────────────
// NKS Database Schema — Barrel Export
// Domain-grouped for readability.
// ─────────────────────────────────────────────

// Base
export * from './base.entity';
export * from './enums';

// Auth & Users
export * from './auth';

// Store & Tenant
export * from './store';

// RBAC (Roles, Routes, Permissions)
export * from './rbac';

// Location (India)
export * from './location';

// Tax Engine
export * from './tax';

// Lookup Tables (code-based + dedicated)
export * from './lookups';

// Notifications
export * from './notifications';

// Entity System (polymorphic entity, status)
export * from './entity-system';

// Communication, Contact Persons, Notes, Staff Invites
export * from './communication';

// Plans, Pricing, Subscriptions
export * from './plans';

// Audit
export * from './audit-log';

// Sync (idempotency log, offline sync support)
export * from './sync';

// Standalone
export * from './user-preferences';
export * from './system-config';
export * from './files';
export * from './rate-limit-entries';
export * from './jti-blocklist';
export * from './permissions-changelog';
export * from './revoked-devices';
