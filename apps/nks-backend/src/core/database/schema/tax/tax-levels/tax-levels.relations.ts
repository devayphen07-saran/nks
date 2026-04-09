import { relations } from 'drizzle-orm';
import { taxLevels } from './tax-levels.table';
import { taxNames } from '../../tax/tax-names';
import { taxLevelMapping } from '../../tax/tax-level-mapping';

export const taxLevelsRelations = relations(taxLevels, ({ one, many }) => ({
  taxName: one(taxNames, {
    fields: [taxLevels.taxNameFk],
    references: [taxNames.id],
  }),
  mappings: many(taxLevelMapping),
}));
