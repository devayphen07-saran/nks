import { ParseEntityPipe } from '../../../../common/pipes';
import { StatusRepository } from '../repositories/status.repository';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

/**
 * Validates `:guuid` route param exists in the status table.
 * Throws NotFoundException if not found, returns the full Status row on success.
 *
 * Usage:
 *   @Param('guuid', ParseUUIDPipe, ParseStatusPipe) status: Status
 */
export const ParseStatusPipe = ParseEntityPipe(
  StatusRepository,
  errPayload(ErrorCode.STA_STATUS_NOT_FOUND),
);
