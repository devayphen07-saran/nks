import { relations } from 'drizzle-orm';
import { lookup } from './lookup.table';

// Generic lookup values have no incoming relationships in the current schema.
// Relations are defined when specific lookup types become dependent entities.
export const lookupRelations = relations(lookup, () => ({}));
