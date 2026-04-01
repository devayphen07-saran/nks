// ─────────────────────────────────────────────
// NKS Database Schema — Barrel Export
// All tables follow the "Split Pattern":
//   schema/<entity>/<entity>.table.ts
//   schema/<entity>/<entity>.relations.ts (if applicable)
//   schema/<entity>/index.ts
// ─────────────────────────────────────────────

// Enums
export * from './schema/enums';

// Core Auth
export * from './schema/users';
export * from './schema/user-session';
export * from './schema/user-auth-provider';
export * from './schema/otp-verification';
export * from './schema/otp-request-log';

// RBAC
export * from './schema/roles';
export * from './schema/permissions';
export * from './schema/routes';
export * from './schema/user-role-mapping';
export * from './schema/role-permission-mapping';
export * from './schema/role-entity-permission';
export * from './schema/role-route-mapping';
export * from './schema/user-permission-mapping';

// Invites
export * from './schema/staff-invite';
export * from './schema/staff-invite-permission';

// Notifications
export * from './schema/notification-types';
export * from './schema/notification-templates';
export * from './schema/push-tokens';
export * from './schema/notifications';

// User
export * from './schema/user-preferences';

// Audit
export * from './schema/audit-log';

// Store & Tenant
export * from './schema/store-legal-type';
export * from './schema/store-category';
export * from './schema/store';
export * from './schema/designation';
export * from './schema/store-user-mapping';
export * from './schema/store-operating-hours'; // Replaces store-business-hours and store-shift

// Location
export * from './schema/country';
export * from './schema/state-region-province';
export * from './schema/administrative-division';
export * from './schema/postal_code';
// Note: Currency is embedded in country table — no separate currency table

// Polymorphic System
export * from './schema/entity';
export * from './schema/address';
export * from './schema/communication';
export * from './schema/contact-person';
export * from './schema/notes';

// Lookup Registries
export * from './schema/volumes';
export * from './schema/address-type';
export * from './schema/communication-type';
export * from './schema/notes-type';
export * from './schema/contact-person-type';
export * from './schema/salutation';

// Tax Engine — Phase 1 (Multi-Country)
// Order matters: agencies → names → levels → mapping → registrations → lines
export * from './schema/commodity-codes';
export * from './schema/tax-agencies';
export * from './schema/tax-names';
export * from './schema/tax-levels';
export * from './schema/tax-level-mapping';
export * from './schema/tax-registrations';
export * from './schema/tax-rate-master';
export * from './schema/daily-tax-summary';
export * from './schema/transaction-tax-lines';
