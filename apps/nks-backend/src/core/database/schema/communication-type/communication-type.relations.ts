import { relations } from 'drizzle-orm';
import { communicationType } from './communication-type.table';
import { communication } from '../communication';

export const communicationTypeRelations = relations(
  communicationType,
  ({ many }) => ({
    communications: many(communication),
  }),
);
