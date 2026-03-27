import { relations } from 'drizzle-orm';
import { volumes } from './volumes.table';

export const volumesRelations = relations(volumes, ({ one }) => ({
  baseVolume: one(volumes, {
    fields: [volumes.baseVolumeFk],
    references: [volumes.id],
    relationName: 'volume_conversion',
  }),
}));
