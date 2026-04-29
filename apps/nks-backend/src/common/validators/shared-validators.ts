import { BadRequestException } from '@nestjs/common';
import { ErrorCode, errPayload } from '../constants/error-codes.constants';

/**
 * Shared validation utilities to eliminate duplication across 29 validator files.
 * Single source of truth for email, password, phone validation rules.
 * Changes here automatically apply everywhere.
 */
export class SharedValidators {
  /**
   * Validate email format.
   * RFC 5322 simplified regex — accepts most common email formats.
   */
  static validateEmail(email: string | null | undefined): string {
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'Email is required'),
      );
    }

    const trimmed = email.trim();

    // Basic RFC 5322 check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'Invalid email format'),
      );
    }

    // Max length check (RFC 5321)
    if (trimmed.length > 254) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'Email too long (max 254 characters)'),
      );
    }

    return trimmed;
  }

  /**
   * Validate password strength.
   * Rules: min 8 chars, at least one uppercase, at least one lowercase, at least one digit.
   */
  static validatePassword(password: string | null | undefined): string {
    if (!password || typeof password !== 'string') {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'Password is required'),
      );
    }

    if (password.length < 8) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'Password must be at least 8 characters'),
      );
    }

    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'Password must contain at least one uppercase letter'),
      );
    }

    if (!/[a-z]/.test(password)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'Password must contain at least one lowercase letter'),
      );
    }

    if (!/\d/.test(password)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'Password must contain at least one digit'),
      );
    }

    return password;
  }

  /**
   * Validate Indian phone number.
   * Accepts: +91-XXXXX XXXXX, +91 XXXXXXXXXX, etc.
   * Returns normalized format: +91XXXXXXXXXX (10 digits after country code)
   */
  static validatePhoneNumber(phone: string | null | undefined): string {
    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'Phone number is required'),
      );
    }

    const trimmed = phone.trim();

    // Accept multiple formats for input
    // +91-9876543210, +91 9876543210, +919876543210, 9876543210
    const phoneRegex = /^\+?91[\s\-]?[6-9]\d{9}$|^[6-9]\d{9}$/;
    if (!phoneRegex.test(trimmed)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'Invalid phone number format. Use: +91-XXXXX XXXXX'),
      );
    }

    // Normalize: extract 10 digits after country code
    const digits = trimmed.replace(/\D/g, '');
    const normalized = digits.length === 12 ? digits.slice(2) : digits;

    if (normalized.length !== 10) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'Phone number must have 10 digits'),
      );
    }

    return `+91${normalized}`;
  }

  /**
   * Validate OTP (6 digits).
   */
  static validateOtp(otp: string | null | undefined): string {
    if (!otp || typeof otp !== 'string') {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'OTP is required'),
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, 'OTP must be 6 digits'),
      );
    }

    return otp;
  }

  /**
   * Validate non-empty string.
   */
  static validateNonEmptyString(
    value: string | null | undefined,
    fieldName: string,
    maxLength?: number,
  ): string {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, `${fieldName} is required`),
      );
    }

    const trimmed = value.trim();

    if (maxLength && trimmed.length > maxLength) {
      throw new BadRequestException(
        errPayload(
          ErrorCode.VALIDATION_ERROR,
          `${fieldName} must not exceed ${maxLength} characters`,
        ),
      );
    }

    return trimmed;
  }

  /**
   * Validate UUID format (v4).
   */
  static validateUUID(uuid: string | null | undefined, fieldName: string = 'ID'): string {
    if (!uuid || typeof uuid !== 'string') {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, `${fieldName} is required`),
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, `Invalid UUID format for ${fieldName}`),
      );
    }

    return uuid;
  }

  /**
   * Validate positive integer.
   */
  static validatePositiveInteger(
    value: unknown,
    fieldName: string,
  ): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR, `${fieldName} must be a positive integer`),
      );
    }

    return value;
  }
}