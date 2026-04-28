import type { Db } from '../types.js';
import { lookupType } from '../../../src/core/database/schema/lookups/lookup-type/lookup-type.table.js';

export async function seedLookupTypes(db: Db) {
  return db.insert(lookupType).values([
    // Generic types — values live in the lookup table
    { code: 'SALUTATION',            title: 'Salutation',            description: 'Person title (Mr., Mrs., Dr., etc.)',       isSystem: true },
    { code: 'CONTACT_PERSON_TYPE',   title: 'Contact Person Type',   description: 'Role of a contact person',                  isSystem: true },
    { code: 'NOTES_TYPE',            title: 'Notes Type',            description: 'Category of notes',                         isSystem: true },
    { code: 'PLAN_TYPE',             title: 'Plan Type',             description: 'Subscription plan category',                isSystem: true },
    { code: 'STORE_CATEGORY',        title: 'Store Category',        description: 'Type of store / business',                  isSystem: true },
    { code: 'STORE_LEGAL_TYPE',      title: 'Store Legal Type',      description: 'Legal structure of the business',           isSystem: true },
    { code: 'TAX_LINE_STATUS',       title: 'Tax Line Status',       description: 'Approval state of a transaction tax line',  isSystem: true },
    { code: 'TAX_REGISTRATION_TYPE', title: 'Tax Registration Type', description: 'Type of GST/tax registration',              isSystem: true },
    // Dedicated-table types — values live in their own tables
    { code: 'ADDRESS_TYPE',          title: 'Address Type',          description: 'Type of postal address',                    isSystem: true, hasTable: true },
    { code: 'BILLING_FREQUENCY',     title: 'Billing Frequency',     description: 'Subscription billing cycle',                isSystem: true, hasTable: true },
    { code: 'COMMUNICATION_TYPE',    title: 'Communication Type',    description: 'Communication channel (email, phone, etc.)', isSystem: true, hasTable: true },
    { code: 'CURRENCY',              title: 'Currency',              description: 'ISO 4217 currency',                         isSystem: true, hasTable: true },
    { code: 'DESIGNATION_TYPE',      title: 'Designation Type',      description: 'Staff job designation',                     isSystem: true, hasTable: true },
    { code: 'ENTITY_TYPE',           title: 'Entity Type',           description: 'System entity registry',                    isSystem: true, hasTable: true },
    { code: 'NOTIFICATION_STATUS',   title: 'Notification Status',   description: 'Notification delivery state',               isSystem: true, hasTable: true },
    { code: 'STAFF_INVITE_STATUS',   title: 'Staff Invite Status',   description: 'Staff invitation lifecycle',                isSystem: true, hasTable: true },
    { code: 'TAX_FILING_FREQUENCY',  title: 'Tax Filing Frequency',  description: 'Tax return filing cycle',                   isSystem: true, hasTable: true },
    { code: 'VOLUMES',               title: 'Volumes',               description: 'Unit of measurement',                       isSystem: true, hasTable: true },
  ]).onConflictDoNothing();
}
