import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * Password Service
 * Handles password hashing, validation, and strength checking
 */
@Injectable()
export class PasswordService {
  private readonly BCRYPT_ROUNDS = 12;

  /**
   * Validate password strength.
   * Requirements:
   * - At least 12 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character
   */
  validateStrength(password: string): void {
    if (password.length < 12) {
      throw new BadRequestException(
        'Password must be at least 12 characters long',
      );
    }

    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one uppercase letter',
      );
    }

    if (!/[a-z]/.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one lowercase letter',
      );
    }

    if (!/[0-9]/.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one number',
      );
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one special character (!@#$%^&*)',
      );
    }
  }

  /**
   * Hash a password using bcrypt.
   */
  async hash(password: string): Promise<string> {
    this.validateStrength(password);
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  /**
   * Compare a plain password with a bcrypt hash.
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
