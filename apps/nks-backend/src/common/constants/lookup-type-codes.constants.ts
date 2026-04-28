/**
 * Canonical codes for all lookup_type rows.
 * Use these constants instead of bare strings when referencing lookup types
 * in services, validators, and seed files.
 */

export const LookupTypeCodes = {
  // ── Generic types (values stored in the lookup table) ─────────────────────
  SALUTATION:            'SALUTATION',
  CONTACT_PERSON_TYPE:   'CONTACT_PERSON_TYPE',
  NOTES_TYPE:            'NOTES_TYPE',
  PLAN_TYPE:             'PLAN_TYPE',
  STORE_CATEGORY:        'STORE_CATEGORY',
  STORE_LEGAL_TYPE:      'STORE_LEGAL_TYPE',
  TAX_LINE_STATUS:       'TAX_LINE_STATUS',
  TAX_REGISTRATION_TYPE: 'TAX_REGISTRATION_TYPE',

  // ── Dedicated-table types (hasTable = true — values in their own tables) ──
  ADDRESS_TYPE:          'ADDRESS_TYPE',
  BILLING_FREQUENCY:     'BILLING_FREQUENCY',
  COMMUNICATION_TYPE:    'COMMUNICATION_TYPE',
  CURRENCY:              'CURRENCY',
  DESIGNATION_TYPE:      'DESIGNATION_TYPE',
  ENTITY_TYPE:           'ENTITY_TYPE',
  NOTIFICATION_STATUS:   'NOTIFICATION_STATUS',
  STAFF_INVITE_STATUS:   'STAFF_INVITE_STATUS',
  TAX_FILING_FREQUENCY:  'TAX_FILING_FREQUENCY',
  VOLUMES:               'VOLUMES',
} as const;

export type LookupTypeCode = typeof LookupTypeCodes[keyof typeof LookupTypeCodes];
