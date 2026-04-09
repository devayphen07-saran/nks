import type { Db } from './types.js';
import { planType } from '../../src/core/database/schema/lookups/plan-type';

const data = [
  { code: 'STARTER', label: 'Starter', description: 'Entry-level plan for small businesses' },
  { code: 'PROFESSIONAL', label: 'Professional', description: 'Mid-tier plan for growing businesses' },
  { code: 'ENTERPRISE', label: 'Enterprise', description: 'Full-featured plan for large organizations' },
  { code: 'PREMIUM', label: 'Premium', description: 'Premium features and support' },
  { code: 'STANDARD', label: 'Standard', description: 'Standard plan with core features' },
  { code: 'TRIAL', label: 'Trial', description: 'Free trial plan' },
];

export async function seedPlanTypes(db: Db) {
  return db.insert(planType).values(data).onConflictDoNothing();
}
