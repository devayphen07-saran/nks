import { relations } from 'drizzle-orm';
import { pushTokens } from './push-tokens.table';

export const pushTokensRelations = relations(pushTokens, () => ({}));
