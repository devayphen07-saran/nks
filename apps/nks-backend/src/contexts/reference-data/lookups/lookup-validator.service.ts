import { Injectable, Logger } from '@nestjs/common';
import { BadRequestException } from '../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import { LookupsRepository } from './repositories/lookups.repository';
import type { LookupTypeCode } from '../../../common/constants/lookup-type-codes.constants';

export interface LookupFkPair {
  guuid: string;
  typeCode: LookupTypeCode;
  /** Human-readable field name for error messages, e.g. 'storeLegalType' */
  field?: string;
}

/**
 * LookupValidatorService
 *
 * Injectable service for validating lookup FK guuids at the service layer.
 * Any service that accepts a guuid referencing a lookup value (hasTable=false type)
 * should call assertExists() before writing to the database.
 *
 * Usage:
 *   await this.lookupValidator.assertExists(dto.storeLegalTypeGuuid, LookupTypeCodes.STORE_LEGAL_TYPE);
 *   await this.lookupValidator.assertAllExist([
 *     { guuid: dto.storeLegalTypeGuuid, typeCode: LookupTypeCodes.STORE_LEGAL_TYPE },
 *     { guuid: dto.storeCategoryGuuid,  typeCode: LookupTypeCodes.STORE_CATEGORY  },
 *   ]);
 */
@Injectable()
export class LookupValidatorService {
  private readonly logger = new Logger(LookupValidatorService.name);

  constructor(private readonly repository: LookupsRepository) {}

  /** Throws BadRequestException if the guuid does not exist as an active value under typeCode. */
  async assertExists(guuid: string, typeCode: LookupTypeCode): Promise<void> {
    const exists = await this.repository.existsByGuuidAndType(guuid, typeCode);
    if (!exists) {
      throw new BadRequestException(errPayload(ErrorCode.LOOKUP_VALUE_NOT_FOUND));
    }
  }

  /**
   * Asserts all pairs in parallel.
   * Throws on the first failure encountered (Promise.all semantics).
   */
  async assertAllExist(pairs: LookupFkPair[]): Promise<void> {
    await Promise.all(
      pairs.map(({ guuid, typeCode }) => this.assertExists(guuid, typeCode)),
    );
  }

  /**
   * Resolves a guuid to its numeric lookup.id.
   * Returns null if the guuid is not found (use assertExists first if null is not acceptable).
   */
  async resolveId(guuid: string, typeCode: LookupTypeCode): Promise<number | null> {
    const row = await this.repository.findLookupValueByGuuidAndType(guuid, typeCode);
    return row?.numericId ?? null;
  }

  /**
   * Asserts the guuid exists and returns its numeric lookup.id in one round-trip.
   * Use this when you need both validation and the resolved ID.
   */
  async assertAndResolve(guuid: string, typeCode: LookupTypeCode): Promise<number> {
    const row = await this.repository.findLookupValueByGuuidAndType(guuid, typeCode);
    if (!row) throw new BadRequestException(errPayload(ErrorCode.LOOKUP_VALUE_NOT_FOUND));
    return row.numericId;
  }
}
