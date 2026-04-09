import type { Db } from './types.js';
import { designationType } from '../../src/core/database/schema/lookups/designation-type';

const data = [
  { code: 'OWNER', label: 'Owner', description: 'Business Owner', department: 'Management', reportingLevel: 1 },
  { code: 'DIRECTOR', label: 'Director', description: 'Director', department: 'Management', reportingLevel: 1 },
  { code: 'MANAGER', label: 'Manager', description: 'Store/Department Manager', department: 'Management', reportingLevel: 2 },
  { code: 'SUPERVISOR', label: 'Supervisor', description: 'Team Supervisor', department: 'Operations', reportingLevel: 2 },
  { code: 'CASHIER', label: 'Cashier', description: 'Cash Handler', department: 'Finance', reportingLevel: 3 },
  { code: 'ACCOUNTANT', label: 'Accountant', description: 'Accounts Staff', department: 'Finance', reportingLevel: 3 },
  { code: 'SALES_EXEC', label: 'Sales Executive', description: 'Sales Staff', department: 'Sales', reportingLevel: 3 },
  { code: 'DELIVERY_EXEC', label: 'Delivery Executive', description: 'Logistics/Delivery', department: 'Operations', reportingLevel: 3 },
  { code: 'SECURITY', label: 'Security Staff', description: 'Security Personnel', department: 'Operations', reportingLevel: 3 },
  { code: 'CLEANER', label: 'Cleaner', description: 'Cleaning Staff', department: 'Operations', reportingLevel: 3 },
  { code: 'STAFF', label: 'Staff', description: 'General Staff', department: 'Operations', reportingLevel: 3 },
];

export async function seedDesignationTypes(db: Db) {
  return db.insert(designationType).values(data).onConflictDoNothing();
}
