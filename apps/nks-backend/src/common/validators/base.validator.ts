import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../core/constants/error-codes';

/**
 * BaseValidator
 * Provides reusable validation utilities for format and existence checks
 */
export class BaseValidator {
  /**
   * Validate that a value is a positive integer
   * @throws BadRequestException if validation fails
   */
  static validatePositiveInteger(
    value: unknown,
    fieldName: string = 'ID',
    errorCode: string = ErrorCodes.GEN_INVALID_INPUT,
  ): void {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      throw new BadRequestException({
        errorCode,
        message: ErrorMessages[errorCode],
      });
    }
  }

  /**
   * Validate that a value is not null/undefined
   * @throws BadRequestException if validation fails
   */
  static validateNotEmpty(
    value: unknown,
    fieldName: string = 'Value',
    errorCode: string = ErrorCodes.GEN_INVALID_INPUT,
  ): void {
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException({
        errorCode,
        message: ErrorMessages[errorCode],
      });
    }
  }

  /**
   * Validate that a value matches a regex pattern
   * @throws BadRequestException if validation fails
   */
  static validatePattern(
    value: string,
    pattern: RegExp,
    fieldName: string = 'Value',
    errorCode: string = ErrorCodes.GEN_INVALID_INPUT,
  ): void {
    if (!pattern.test(value)) {
      throw new BadRequestException({
        errorCode,
        message: ErrorMessages[errorCode],
      });
    }
  }

  /**
   * Validate that a value is in an allowed list
   * @throws BadRequestException if validation fails
   */
  static validateEnum(
    value: unknown,
    allowedValues: (string | number)[],
    fieldName: string = 'Value',
    errorCode: string = ErrorCodes.GEN_INVALID_INPUT,
  ): void {
    if (!allowedValues.includes(value as string | number)) {
      throw new BadRequestException({
        errorCode,
        message: ErrorMessages[errorCode],
      });
    }
  }

  /**
   * Validate that an entity exists in the database
   * @throws NotFoundException if entity not found
   */
  static validateEntityExists(
    entity: unknown,
    entityName: string,
    errorCode: string,
  ): void {
    if (!entity) {
      throw new NotFoundException({
        errorCode,
        message: ErrorMessages[errorCode],
      });
    }
  }

  /**
   * Validate string length
   * @throws BadRequestException if validation fails
   */
  static validateStringLength(
    value: string,
    minLength: number,
    maxLength: number,
    fieldName: string = 'Value',
    errorCode: string = ErrorCodes.GEN_INVALID_INPUT,
  ): void {
    if (value.length < minLength || value.length > maxLength) {
      throw new BadRequestException({
        errorCode,
        message: ErrorMessages[errorCode],
      });
    }
  }

  /**
   * Validate number range
   * @throws BadRequestException if validation fails
   */
  static validateNumberRange(
    value: number,
    min: number,
    max: number,
    fieldName: string = 'Value',
    errorCode: string = ErrorCodes.GEN_INVALID_INPUT,
  ): void {
    if (value < min || value > max) {
      throw new BadRequestException({
        errorCode,
        message: ErrorMessages[errorCode],
      });
    }
  }
}
