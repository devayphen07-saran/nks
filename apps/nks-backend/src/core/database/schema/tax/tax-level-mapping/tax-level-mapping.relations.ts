import { relations } from 'drizzle-orm';
import { taxLevelMapping } from './tax-level-mapping.table';
import { taxAgencies } from '../../tax/tax-agencies';
import { taxNames } from '../../tax/tax-names';
import { taxLevels } from '../../tax/tax-levels';

export const taxLevelMappingRelations = relations(
  taxLevelMapping,
  ({ one }) => ({
    agency: one(taxAgencies, {
      fields: [taxLevelMapping.taxAgencyFk],
      references: [taxAgencies.id],
    }),
    taxName: one(taxNames, {
      fields: [taxLevelMapping.taxNameFk],
      references: [taxNames.id],
    }),
    level: one(taxLevels, {
      fields: [taxLevelMapping.taxLevelFk],
      references: [taxLevels.id],
    }),
  }),
);
