import { relations } from 'drizzle-orm';
import { otpRequestLog } from './otp-request-log.table';

export const otpRequestLogRelations = relations(otpRequestLog, () => ({}));
