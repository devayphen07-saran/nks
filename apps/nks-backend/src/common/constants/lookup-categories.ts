/**
 * Lookup Category Constants
 * Magic strings used throughout the codebase to reference lookup categories
 * Extracted for type safety and consistency
 *
 * Usage:
 * ```typescript
 * const salutations = await lookupRepository.getCategoryValues(LOOKUP_CATEGORIES.SALUTATION);
 * ```
 */

export const LOOKUP_CATEGORIES = {
  // Store lookups
  STORE_LEGAL_TYPE: 'STORE_LEGAL_TYPE',
  STORE_CATEGORY: 'STORE_CATEGORY',

  // Address and Location lookups
  ADDRESS_TYPE: 'ADDRESS_TYPE',

  // Contact person lookups
  SALUTATION: 'SALUTATION',
  DESIGNATION: 'DESIGNATION',
  CONTACT_PERSON_TYPE: 'CONTACT_PERSON_TYPE',

  // Communication lookups
  COMMUNICATION_TYPE: 'COMMUNICATION_TYPE',

  // Billing and Subscription lookups
  BILLING_FREQUENCY: 'BILLING_FREQUENCY',
  PLAN_TYPE: 'PLAN_TYPE',

  // Notification lookups
  NOTIFICATION_STATUS: 'NOTIFICATION_STATUS',
  NOTIFICATION_TYPE: 'NOTIFICATION_TYPE',

  // Staff Management lookups
  STAFF_INVITE_STATUS: {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REVOKED: 'REVOKED',
    EXPIRED: 'EXPIRED',
  },

  // Tax lookups
  TAX_REGISTRATION_TYPE: 'TAX_REGISTRATION_TYPE',
  TAX_FILING_FREQUENCY: 'TAX_FILING_FREQUENCY',
  TAX_LINE_STATUS: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    DRAFT: 'DRAFT',
  },

  // Entity lookups
  ENTITY_TYPE: 'ENTITY_TYPE',
} as const;

/**
 * Entity Code Constants
 * Magic strings used in role-entity-permission mapping
 * These should eventually be stored in entity_type lookup table
 */
export const ENTITY_CODES = {
  INVOICE: 'INVOICE',
  PRODUCT: 'PRODUCT',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  REPORT: 'REPORT',
  CUSTOMER: 'CUSTOMER',
  VENDOR: 'VENDOR',
  INVENTORY: 'INVENTORY',
  TRANSACTION: 'TRANSACTION',
  PAYMENT: 'PAYMENT',
} as const;

/**
 * Plan Type Codes
 */
export const PLAN_TYPE_CODES = {
  STARTER: 'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
  PREMIUM: 'PREMIUM',
  STANDARD: 'STANDARD',
  TRIAL: 'TRIAL',
} as const;

/**
 * Tax Line Status Codes
 */
export const TAX_LINE_STATUS_CODES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

/**
 * Staff Invite Status Codes
 */
export const STAFF_INVITE_STATUS_CODES = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;

/**
 * Notification Status Codes
 */
export const NOTIFICATION_STATUS_CODES = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;

/**
 * Address Type Codes
 */
export const ADDRESS_TYPE_CODES = {
  HOME: 'HOME',
  OFFICE: 'OFFICE',
  BILLING: 'BILLING',
  SHIPPING: 'SHIPPING',
  WAREHOUSE: 'WAREHOUSE',
  FACTORY: 'FACTORY',
  OTHER: 'OTHER',
} as const;

/**
 * Store Legal Type Codes
 */
export const STORE_LEGAL_TYPE_CODES = {
  PVT_LTD: 'PVT_LTD',
  LLP: 'LLP',
  SOLE_PROP: 'SOLE_PROP',
  PARTNERSHIP: 'PARTNERSHIP',
  PUBLIC_LTD: 'PUBLIC_LTD',
  OPC: 'OPC',
  NIDHI_CO: 'NIDHI_CO',
  COOPERATIVE: 'COOPERATIVE',
  NGO: 'NGO',
} as const;

/**
 * Store Category Codes
 */
export const STORE_CATEGORY_CODES = {
  GENERAL_STORE: 'GENERAL_STORE',
  GROCERY: 'GROCERY',
  PHARMACY: 'PHARMACY',
  APPAREL: 'APPAREL',
  FOOTWEAR: 'FOOTWEAR',
  ELECTRONICS: 'ELECTRONICS',
  FURNITURE: 'FURNITURE',
  JEWELLERY: 'JEWELLERY',
  BEAUTY: 'BEAUTY',
  RESTAURANT: 'RESTAURANT',
  CAFE: 'CAFE',
  BAKERY: 'BAKERY',
  HARDWARE: 'HARDWARE',
  STATIONARY: 'STATIONARY',
  SPORTS: 'SPORTS',
} as const;

/**
 * Billing Frequency Codes
 */
export const BILLING_FREQUENCY_CODES = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  SEMI_ANNUAL: 'SEMI_ANNUAL',
  ANNUAL: 'ANNUAL',
  ONE_TIME: 'ONE_TIME',
} as const;

/**
 * Salutation Codes
 */
export const SALUTATION_CODES = {
  MR: 'MR',
  MRS: 'MRS',
  MS: 'MS',
  DR: 'DR',
  PROF: 'PROF',
  HON: 'HON',
  REV: 'REV',
  IMAM: 'IMAM',
  SRI: 'SRI',
  SHRI: 'SHRI',
  SRIMATI: 'SRIMATI',
} as const;

/**
 * Designation Codes
 */
export const DESIGNATION_CODES = {
  OWNER: 'OWNER',
  DIRECTOR: 'DIRECTOR',
  MANAGER: 'MANAGER',
  SUPERVISOR: 'SUPERVISOR',
  CASHIER: 'CASHIER',
  ACCOUNTANT: 'ACCOUNTANT',
  SALES_EXEC: 'SALES_EXEC',
  DELIVERY_EXEC: 'DELIVERY_EXEC',
  SECURITY: 'SECURITY',
  CLEANER: 'CLEANER',
  STAFF: 'STAFF',
} as const;

/**
 * Tax Registration Type Codes
 */
export const TAX_REGISTRATION_TYPE_CODES = {
  REGULAR: 'REGULAR',
  COMPOSITION: 'COMPOSITION',
  EXEMPT: 'EXEMPT',
  SEZ: 'SEZ',
  SPECIAL: 'SPECIAL',
} as const;

/**
 * Tax Filing Frequency Codes
 */
export const TAX_FILING_FREQUENCY_CODES = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  HALF_YEARLY: 'HALF_YEARLY',
  ANNUAL: 'ANNUAL',
} as const;
