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
        errPayload(ErrorCode.VALIDATION_ERROR),
      );
    }

    const trimmed = email.trim();

    // Basic RFC 5322 check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR),
      );
    }

    // Max length check (RFC 5321)
    if (trimmed.length > 254) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR),
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
        errPayload(ErrorCode.VALIDATION_ERROR),
      );
    }

    if (password.length < 8) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR),
      );
    }

    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR),
      );
    }

    if (!/[a-z]/.test(password)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR),
      );
    }

    if (!/\d/.test(password)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR),
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
        errPayload(ErrorCode.VALIDATION_ERROR),
      );
    }

    const trimmed = phone.trim();

    // Accept multiple formats for input
    // +91-9876543210, +91 9876543210, +919876543210, 9876543210
    const phoneRegex = /^\+?91[\s\-]?[6-9]\d{9}$|^[6-9]\d{9}$/;
    if (!phoneRegex.test(trimmed)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR),
      );
    }

    // Normalize: extract 10 digits after country code
    const digits = trimmed.replace(/\D/g, '');
    const normalized = digits.length === 12 ? digits.slice(2) : digits;

    if (normalized.length !== 10) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR),
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
        errPayload(ErrorCode.VALIDATION_ERROR),
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR),
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
        errPayload(ErrorCode.VALIDATION_ERROR),
      );
    }

    const trimmed = value.trim();

    if (maxLength && trimmed.length > maxLength) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR),
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
        errPayload(ErrorCode.VALIDATION_ERROR),
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      throw new BadRequestException(
        errPayload(ErrorCode.VALIDATION_ERROR),
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
        errPayload(ErrorCode.VALIDATION_ERROR),
      );
    }

    return value;
  }
}