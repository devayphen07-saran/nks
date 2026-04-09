import { BadRequestException } from '@nestjs/common';

/** Device type enum — must match sessionDeviceTypeEnum in database */
export enum DeviceTypeEnum {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
  WEB = 'WEB',
}

/** Authentication method enum — must match authMethodEnum in database */
export enum AuthMethodEnum {
  OTP = 'OTP',
  PASSWORD = 'PASSWORD',
  GOOGLE = 'GOOGLE',
}

/**
 * SessionValidator
 * Validates session-related enum values
 */
export class SessionValidator {
  /**
   * Validate and normalize device type to database enum
   */
  static validateDeviceType(deviceType?: string): DeviceTypeEnum | undefined {
    if (!deviceType) return undefined;
    if (Object.values(DeviceTypeEnum).includes(deviceType as DeviceTypeEnum)) {
      return deviceType as DeviceTypeEnum;
    }
    throw new BadRequestException(
      `Invalid device type: ${deviceType}. Must be one of: ${Object.values(DeviceTypeEnum).join(', ')}`,
    );
  }

  /**
   * Validate and normalize login method to database enum
   */
  static validateLoginMethod(loginMethod?: string): AuthMethodEnum | undefined {
    if (!loginMethod) return undefined;
    if (Object.values(AuthMethodEnum).includes(loginMethod as AuthMethodEnum)) {
      return loginMethod as AuthMethodEnum;
    }
    throw new BadRequestException(
      `Invalid login method: ${loginMethod}. Must be one of: ${Object.values(AuthMethodEnum).join(', ')}`,
    );
  }
}
