import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';
import { InternalServerException } from '../../common/exceptions';
import { ErrorCode, errPayload } from '../../common/constants/error-codes.constants';

export class RSAKeyManager {
  private static readonly logger = new Logger(RSAKeyManager.name);
  private static readonly PRIVATE_KEY_PATH = path.join(
    process.cwd(),
    'secrets/jwt_rsa_private.pem',
  );
  private static readonly PUBLIC_KEY_PATH = path.join(
    process.cwd(),
    'secrets/jwt_rsa_public.pem',
  );

  /**
   * Generate RSA-2048 key pair (run once during setup)
   */
  static generateKeyPair(): void {
    this.logger.log('Generating RSA-2048 key pair...');

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const secretsDir = path.dirname(this.PRIVATE_KEY_PATH);
    if (!fs.existsSync(secretsDir)) {
      fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
    }

    fs.writeFileSync(this.PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
    fs.writeFileSync(this.PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });

    this.logger.log(`RSA keys generated — private: ${this.PRIVATE_KEY_PATH} (0600), public: ${this.PUBLIC_KEY_PATH} (0644)`);
  }

  static getPrivateKey(): string {
    if (!fs.existsSync(this.PRIVATE_KEY_PATH)) {
      this.logger.error(`Private key not found at ${this.PRIVATE_KEY_PATH}. Run: npm run generate:jwt-keys`);
      throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
    }
    return fs.readFileSync(this.PRIVATE_KEY_PATH, 'utf8');
  }

  static getPublicKey(): string {
    if (!fs.existsSync(this.PUBLIC_KEY_PATH)) {
      this.logger.error(`Public key not found at ${this.PUBLIC_KEY_PATH}. Run: npm run generate:jwt-keys`);
      throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
    }
    return fs.readFileSync(this.PUBLIC_KEY_PATH, 'utf8');
  }
}
