import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PasswordValidator } from '../../../../../common/validators/password.validator';
import { PasswordBreachCheckService } from './password-breach-check.service';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  private readonly bcryptRounds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly breachCheck: PasswordBreachCheckService,
  ) {
    const configured = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    this.bcryptRounds = Math.min(14, Math.max(10, Number(configured)));
  }

  get rounds(): number {
    return this.bcryptRounds;
  }

  validateStrength(password: string): void {
    PasswordValidator.validateStrength(password);
  }

  /**
   * Validate strength + check against HaveIBeenPwned.
   * Use on register / password-set / password-change flows.
   * Login uses bcrypt.compare directly (no re-validation of stored passwords).
   */
  async hash(password: string): Promise<string> {
    this.validateStrength(password);
    await this.breachCheck.assertNotBreached(password);
    return bcrypt.hash(password, this.bcryptRounds);
  }

  // Hashes without strength validation — only for internal sentinel values (timing guard).
  async hashRaw(value: string): Promise<string> {
    return bcrypt.hash(value, this.bcryptRounds);
  }

  /**
   * Compare a plain password with a bcrypt hash.
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
