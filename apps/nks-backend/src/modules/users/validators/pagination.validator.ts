import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../../core/constants/error-codes';

/**
 * Pagination Validator
 * Validates pagination parameters (pageSize, page, etc.)
 */
export class PaginationValidator {
  private static readonly MAX_PAGE_SIZE = 100;
  private static readonly MIN_PAGE_SIZE = 1;
  private static readonly MIN_PAGE = 1;

  /**
   * Validate page size and throw BadRequestException if invalid
   */
  static validatePageSize(pageSize: number): void {
    if (!pageSize || pageSize < this.MIN_PAGE_SIZE || pageSize > this.MAX_PAGE_SIZE) {
      throw new BadRequestException({
        errorCode: ErrorCodes.USR_INVALID_PAGE_SIZE,
        message: ErrorMessages[ErrorCodes.USR_INVALID_PAGE_SIZE],
      });
    }
  }

  /**
   * Validate page number and throw BadRequestException if invalid
   */
  static validatePage(page: number): void {
    if (!page || page < this.MIN_PAGE) {
      throw new BadRequestException(
        `Page number must be at least ${this.MIN_PAGE}. Received: ${page}`,
      );
    }
  }

  /**
   * Validate both page and pageSize
   */
  static validatePagination(page: number, pageSize: number): void {
    this.validatePage(page);
    this.validatePageSize(pageSize);
  }

  /**
   * Check if page size is valid without throwing
   */
  static isValidPageSize(pageSize: number): boolean {
    return pageSize >= this.MIN_PAGE_SIZE && pageSize <= this.MAX_PAGE_SIZE;
  }

  /**
   * Get max page size constant
   */
  static getMaxPageSize(): number {
    return this.MAX_PAGE_SIZE;
  }
}
