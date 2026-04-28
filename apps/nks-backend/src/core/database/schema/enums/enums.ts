import { pgEnum } from 'drizzle-orm/pg-core';

// notificationTypeEnum intentionally removed — notification types are now
// stored in the notification_types reference table so new types can be
// added by inserting a row without a code change or migration.

// push_tokens: WEB intentionally excluded — web users do not register Expo push tokens
export const deviceTypeEnum = pgEnum('device_type', ['IOS', 'ANDROID']);

// user_session: WEB included — sessions exist for all platforms
export const sessionDeviceTypeEnum = pgEnum('session_device_type', [
  'IOS',
  'ANDROID',
  'WEB',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'WEBSOCKET',
  'PUSH',
  'BOTH',
]);

// notificationStatusEnum intentionally removed — notification_status is now a lookup table
// for extensibility (isTerminal, isError, isRetryable flags). See notification-status.table.ts

// staffInviteStatusEnum intentionally removed — staff_invite_status is now a lookup table
// for extensibility (isTerminal flag). See staff-invite-status.table.ts

// admin = platform/dashboard routes (SUPER_ADMIN, USER)
// store = store management routes (STORE_OWNER, STAFF)
export const routeScopeEnum = pgEnum('route_scope', ['admin', 'store']);

// sidebar = desktop nav item, tab = mobile bottom tab, screen = navigable page (no icon required),
// modal  = overlay/sheet — typically no nav icon
export const routeTypeEnum = pgEnum('route_type', [
  'sidebar',
  'tab',
  'screen',
  'modal',
]);

// volumeTypeEnum intentionally removed — volumeType is now a plain varchar(50) on the
// volumes table. Adding a new category (e.g. 'temperature') is an insert into seed data,
// not an enum migration. Pattern follows notificationTypeEnum removal above.

// notification_templates: replaces the contradictory isDraft/isActive boolean pair.
// A template is exactly one of these states — never two at once.
export const notificationTemplateStatusEnum = pgEnum(
  'notification_template_status',
  [
    'DRAFT', // being authored, not visible to the delivery system
    'PUBLISHED', // live — exactly one allowed per (type, language)
    'ARCHIVED', // replaced by a newer published version, kept for audit
  ],
);

// storeStatusEnum intentionally removed — store.statusFk now references the status
// reference table (entity-system/status). Valid codes: DRAFT, ACTIVE, INACTIVE,
// SUSPENDED, VERIFIED, ARCHIVED, CLOSED — extensible via seed data, no migration needed.

// otp_verification: why the OTP was issued — LOGIN and RESET_PASSWORD tokens must not be
// interchangeable; purpose enforces that a RESET_PASSWORD token cannot be used to log in.
export const otpPurposeEnum = pgEnum('otp_purpose', [
  'LOGIN',
  'PHONE_VERIFY',
  'EMAIL_VERIFY',
  'RESET_PASSWORD',
]);

export const auditActionTypeEnum = pgEnum('audit_action_type', [
  // Generic CRUD
  'CREATE',
  'UPDATE',
  'DELETE',

  // Auth lifecycle
  'LOGIN',
  'LOGOUT',
  'TOKEN_REFRESH',
  'TOKEN_REVOKE',
  'PASSWORD_RESET',
  'EMAIL_VERIFIED',
  'PHONE_VERIFIED',

  // OTP flow
  'OTP_REQUESTED',
  'OTP_VERIFIED',
  'OTP_FAILED',

  // Invites
  'INVITE_SENT',
  'INVITE_ACCEPTED',
  'INVITE_REVOKED',

  // RBAC
  'ROLE_ASSIGNED',
  'ROLE_REVOKED',
  'PERMISSION_GRANTED',
  'PERMISSION_REVOKED',

  // Store lifecycle
  'STORE_CREATED',
  'STORE_DELETED',

  // Account administration
  'ACCOUNT_BLOCKED',
  'ACCOUNT_UNBLOCKED',
]);

export const authMethodEnum = pgEnum('auth_method', [
  'OTP',
  'PASSWORD',
  'GOOGLE',
]);

// Role types are now handled via roles.roleType column (PLATFORM | STORE_SYSTEM | STORE_CUSTOM)
// and user_role_mapping table — no PostgreSQL enums needed for roles.
