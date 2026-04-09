import type { Db } from './types.js';
import { codeCategory, codeValue } from '../../src/core/database/schema/index.js';
import { eq } from 'drizzle-orm';

const CATEGORIES = [
  { code: 'SALUTATION',         name: 'Salutation',          sortOrder: 1,  isSystem: true },
  { code: 'ADDRESS_TYPE',       name: 'Address Type',        sortOrder: 2,  isSystem: true },
  { code: 'STORE_LEGAL_TYPE',   name: 'Store Legal Type',    sortOrder: 3,  isSystem: true },
  { code: 'STORE_CATEGORY',     name: 'Store Category',      sortOrder: 4,  isSystem: true },
  { code: 'DESIGNATION',        name: 'Designation',         sortOrder: 5,  isSystem: true },
  { code: 'PLAN_TYPE',          name: 'Plan Type',           sortOrder: 6,  isSystem: true },
  { code: 'BILLING_FREQUENCY',  name: 'Billing Frequency',   sortOrder: 7,  isSystem: true },
];

const VALUES: Record<string, { code: string; label: string; sortOrder: number }[]> = {
  SALUTATION: [
    { code: 'MR',    label: 'Mr.',   sortOrder: 1 },
    { code: 'MRS',   label: 'Mrs.',  sortOrder: 2 },
    { code: 'MS',    label: 'Ms.',   sortOrder: 3 },
    { code: 'DR',    label: 'Dr.',   sortOrder: 4 },
    { code: 'SHRI',  label: 'Shri',  sortOrder: 5 },
    { code: 'SMT',   label: 'Smt.',  sortOrder: 6 },
  ],
  ADDRESS_TYPE: [
    { code: 'HOME',      label: 'Home',      sortOrder: 1 },
    { code: 'OFFICE',    label: 'Office',    sortOrder: 2 },
    { code: 'SHIPPING',  label: 'Shipping',  sortOrder: 3 },
    { code: 'BILLING',   label: 'Billing',   sortOrder: 4 },
    { code: 'STORE',     label: 'Store',     sortOrder: 5 },
    { code: 'WAREHOUSE', label: 'Warehouse', sortOrder: 6 },
  ],
  STORE_LEGAL_TYPE: [
    { code: 'SOLE_PROP',   label: 'Sole Proprietor', sortOrder: 1 },
    { code: 'PARTNERSHIP', label: 'Partnership',     sortOrder: 2 },
    { code: 'PVT_LTD',     label: 'Pvt Ltd',         sortOrder: 3 },
    { code: 'LLP',         label: 'LLP',             sortOrder: 4 },
    { code: 'PUBLIC_LTD',  label: 'Public Limited',  sortOrder: 5 },
    { code: 'TRUST',       label: 'Trust / Society', sortOrder: 6 },
    { code: 'INDIVIDUAL',  label: 'Individual',      sortOrder: 7 },
  ],
  STORE_CATEGORY: [
    { code: 'GROCERY',     label: 'Grocery',     sortOrder: 1 },
    { code: 'PHARMACY',    label: 'Pharmacy',    sortOrder: 2 },
    { code: 'RESTAURANT',  label: 'Restaurant',  sortOrder: 3 },
    { code: 'ELECTRONICS', label: 'Electronics', sortOrder: 4 },
    { code: 'CLOTHING',    label: 'Clothing',    sortOrder: 5 },
    { code: 'STATIONERY',  label: 'Stationery',  sortOrder: 6 },
    { code: 'HARDWARE',    label: 'Hardware',    sortOrder: 7 },
    { code: 'OTHER',       label: 'Other',       sortOrder: 8 },
  ],
  DESIGNATION: [
    { code: 'CEO',        label: 'CEO',               sortOrder: 1 },
    { code: 'MD',         label: 'Managing Director',  sortOrder: 2 },
    { code: 'STORE_MGR',  label: 'Store Manager',      sortOrder: 3 },
    { code: 'SALES_EXEC', label: 'Sales Executive',    sortOrder: 4 },
    { code: 'ACCOUNTANT', label: 'Accountant',         sortOrder: 5 },
    { code: 'CASHIER',    label: 'Cashier',            sortOrder: 6 },
    { code: 'DELIVERY',   label: 'Delivery Staff',     sortOrder: 7 },
  ],
  PLAN_TYPE: [
    { code: 'BASIC',       label: 'Basic',       sortOrder: 1 },
    { code: 'STANDARD',    label: 'Standard',    sortOrder: 2 },
    { code: 'PREMIUM',     label: 'Premium',     sortOrder: 3 },
    { code: 'ENTERPRISE',  label: 'Enterprise',  sortOrder: 4 },
  ],
  BILLING_FREQUENCY: [
    { code: 'MONTHLY',    label: 'Monthly',    sortOrder: 1 },
    { code: 'QUARTERLY',  label: 'Quarterly',  sortOrder: 2 },
    { code: 'ANNUAL',     label: 'Annual',     sortOrder: 3 },
    { code: 'ONE_TIME',   label: 'One-Time',   sortOrder: 4 },
  ],
};

export async function seedCodeTable(db: Db) {
  for (const cat of CATEGORIES) {
    await db
      .insert(codeCategory)
      .values({ ...cat, updatedAt: new Date() })
      .onConflictDoNothing();

    const [inserted] = await db
      .select({ id: codeCategory.id })
      .from(codeCategory)
      .where(eq(codeCategory.code, cat.code))
      .limit(1);

    if (!inserted) continue;

    const values = VALUES[cat.code] ?? [];
    if (values.length === 0) continue;

    await db
      .insert(codeValue)
      .values(
        values.map((v) => ({
          categoryFk: inserted.id,
          code:       v.code,
          label:      v.label,
          sortOrder:  v.sortOrder,
          isSystem:   true,
          updatedAt:  new Date(),
        })),
      )
      .onConflictDoNothing();
  }

  console.log('code_category + code_value seeded');
}
