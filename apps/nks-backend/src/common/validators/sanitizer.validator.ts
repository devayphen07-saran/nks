import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../core/constants/error-codes';

/**
 * Sanitizer Validator
 * Cleans and sanitizes user input to prevent injection attacks
 */
export class SanitizerValidator {
  /**
   * Sanitize email - trim, lowercase, remove spaces
   */
  static sanitizeEmail(email: string): string {
    if (!email) return email;
    return email
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  /**
   * Sanitize phone number - remove all non-digit and + characters
   */
  static sanitizePhoneNumber(phone: string): string {
    if (!phone) return phone;
    return phone
      .replace(/[^\d+]/g, '')
      .trim();
  }

  /**
   * Sanitize name - trim, normalize spaces, proper case
   */
  static sanitizeName(name: string): string {
    if (!name) return name;
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Escape HTML special characters to prevent XSS
   */
  static escapeHtml(text: string): string {
    if (!text) return text;
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Remove SQL injection characters (basic protection - parameterized queries are primary)
   */
  static sanitizeSqlInput(input: string): string {
    if (!input) return input;
    return input
      .replace(/'/g, "''")
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '');
  }

  /**
   * Trim and limit string length
   */
  static sanitizeString(text: string, maxLength?: number): string {
    if (!text) return text;
    text = text.trim();
    if (maxLength && text.length > maxLength) {
      return text.substring(0, maxLength);
    }
    return text;
  }

  /**
   * Remove null bytes and control characters
   */
  static removeControlCharacters(text: string): string {
    if (!text) return text;
    return text.replace(/[\x00-\x1F\x7F]/g, '');
  }
}
