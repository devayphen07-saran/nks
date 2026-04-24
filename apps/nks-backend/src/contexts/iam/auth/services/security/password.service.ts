import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PasswordValidator } from '../../../../../common/validators/password.validator';

/**
 * Password Service
 * Handles password hashing, validation, and strength checking
 */
@Injectable()
export class PasswordService {
  static readonly BCRYPT_ROUNDS = 12;

  /**
   * Validate password strength using PasswordValidator.
   */
  validateStrength(password: string): void {
    PasswordValidator.validateStrength(password);
  }

  /**
   * Hash a password using bcrypt.
   */
  async hash(password: string): Promise<string> {
    this.validateStrength(password);
    return bcrypt.hash(password, PasswordService.BCRYPT_ROUNDS);
  }

  /**
   * Compare a plain password with a bcrypt hash.
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
