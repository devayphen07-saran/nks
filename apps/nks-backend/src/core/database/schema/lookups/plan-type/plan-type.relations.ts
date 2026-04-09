import { relations } from 'drizzle-orm';
import { planType } from './plan-type.table';

export const planTypeRelations = relations(planType, () => ({}));
