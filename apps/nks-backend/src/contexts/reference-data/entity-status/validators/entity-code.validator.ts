import { BadRequestException } from '../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

/**
 * Entity Code Validator
 * Validates entity code format (lowercase alphanumeric, underscores, dashes)
 */
export class EntityCodeValidator {
  // Must match entity_type.code convention: SCREAMING_SNAKE_CASE
  private static readonly ENTITY_CODE_REGEX = /^[A-Z0-9_]+$/;

  static validate(entityCode: string): void {
    if (!entityCode || typeof entityCode !== 'string' || !this.ENTITY_CODE_REGEX.test(entityCode.trim())) {
      throw new BadRequestException(errPayload(ErrorCode.ENT_INVALID_CODE_FORMAT));
    }
  }

  static isValid(entityCode: string): boolean {
    return !!(entityCode && typeof entityCode === 'string' && this.ENTITY_CODE_REGEX.test(entityCode.trim()));
  }

  // Callers may pass lowercase — normalize to UPPERCASE before any DB lookup.
  static normalize(entityCode: string): string {
    return entityCode.trim().toUpperCase();
  }
}
