import { NotFoundException } from '../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

export class LocationValidator {
  static assertStateFound<T>(state: T | null | undefined): asserts state is T {
    if (!state) throw new NotFoundException(errPayload(ErrorCode.STATE_NOT_FOUND));
  }

  static assertDistrictFound<T>(district: T | null | undefined): asserts district is T {
    if (!district) throw new NotFoundException(errPayload(ErrorCode.ADMIN_DIVISION_NOT_FOUND));
  }

  static assertDistrictsFound<T>(result: T | null | undefined): asserts result is T {
    if (!result) throw new NotFoundException(errPayload(ErrorCode.STATE_NOT_FOUND));
  }

  static assertPincodeFound<T>(pincode: T | null | undefined): asserts pincode is T {
    if (!pincode) throw new NotFoundException(errPayload(ErrorCode.POSTAL_CODE_NOT_FOUND));
  }
}
