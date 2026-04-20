import { BadRequestException } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constants';
import { PaginationValidator } from '../../modules/users/validators/pagination.validator';

/**
 * Query Validator
 * Validates pagination, sorting, filtering, and search parameters
 */
export class QueryValidator {
  private static readonly ALLOWED_SORT_DIRECTIONS = ['ASC', 'DESC'];

  /**
   * Validate pagination parameters (page and limit)
   */
  static validatePagination(page?: number, limit?: number): void {
    if (page !== undefined && page !== null) {
      PaginationValidator.validatePage(page);
    }
    if (limit !== undefined && limit !== null) {
      PaginationValidator.validatePageSize(limit);
    }
  }

  /**
   * Validate sort field is in allowed list
   */
  static validateSortField(
    field: string | undefined,
    allowedFields: string[],
  ): void {
    if (!field) return; // Sort field is optional

    if (!allowedFields.includes(field)) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: `Sort field must be one of: ${allowedFields.join(', ')}`,
      });
    }
  }

  /**
   * Validate sort direction (ASC or DESC)
   */
  static validateSortDirection(direction?: string): void {
    if (!direction) return; // Direction is optional, defaults to DESC

    const normalized = direction.toUpperCase();
    if (!this.ALLOWED_SORT_DIRECTIONS.includes(normalized)) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: `Sort direction must be ASC or DESC, got: ${direction}`,
      });
    }
  }

  /**
   * Validate date range (startDate before endDate)
   */
  static validateDateRange(
    startDate?: string | Date,
    endDate?: string | Date,
  ): void {
    if (!startDate || !endDate) return;

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        throw new BadRequestException({
          errorCode: ErrorCode.BAD_REQUEST,
          message: 'Start date must be before end date',
        });
      }
    } catch (err) {
      throw new BadRequestException({
        errorCode: ErrorCode.BAD_REQUEST,
        message: 'Invalid date format',
      });
    }
  }

  /**
   * Validate search query length
   */
  static validateSearchQuery(
    query?: string,
    minLength: number = 2,
    maxLength: number = 100,
  ): void {
    if (!query) return; // Search is optional

    if (query.length < minLength || query.length > maxLength) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: `Search query must be between ${minLength} and ${maxLength} characters`,
      });
    }
  }

  /**
   * Validate filter value is in allowed list
   */
  static validateFilterValue(
    field: string,
    value: string | undefined,
    allowedValues: string[],
  ): void {
    if (!value) return; // Filter is optional

    if (!allowedValues.includes(value)) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: `${field} must be one of: ${allowedValues.join(', ')}`,
      });
    }
  }

  /**
   * Validate numeric filter within range
   */
  static validateNumericFilter(
    field: string,
    value?: number,
    min?: number,
    max?: number,
  ): void {
    if (value === undefined || value === null) return;

    if (typeof value !== 'number') {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: `${field} must be a number`,
      });
    }

    if (min !== undefined && value < min) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: `${field} must be at least ${min}`,
      });
    }

    if (max !== undefined && value > max) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: `${field} must be at most ${max}`,
      });
    }
  }

  /**
   * Validate complete query object with all parameters
   */
  static validateFullQuery(query: {
    page?: number;
    limit?: number;
    sort?: string;
    direction?: string;
    search?: string;
    startDate?: string | Date;
    endDate?: string | Date;
  }, sortFields: string[]): void {
    this.validatePagination(query.page, query.limit);
    this.validateSortField(query.sort, sortFields);
    this.validateSortDirection(query.direction);
    this.validateSearchQuery(query.search);
    this.validateDateRange(query.startDate, query.endDate);
  }
}
