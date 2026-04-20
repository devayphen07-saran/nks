import { relations } from 'drizzle-orm';
import { codeValue } from './code-value.table';

export const codeValueRelations = relations(codeValue, () => ({}));
