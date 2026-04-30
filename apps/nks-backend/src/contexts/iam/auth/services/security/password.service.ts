import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PasswordValidator } from '../../../../../common/validators/password.validator';

@Injectable()
export class PasswordService {
  private readonly bcryptRounds: number;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    this.bcryptRounds = Math.min(14, Math.max(10, Number(configured)));
  }

  validateStrength(password: string): void {
    PasswordValidator.validateStrength(password);
  }

  async hash(password: string): Promise<string> {
    this.validateStrength(password);
    return bcrypt.hash(password, this.bcryptRounds);
  }

  /**
   * Compare a plain password with a bcrypt hash.
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
