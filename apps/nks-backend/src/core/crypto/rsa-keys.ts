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

  /**
   * Generate a new RSA-2048 keypair AND atomically replace the on-disk PEM
   * files. Uses write-to-temp + rename so a partial write can never leave the
   * service with a mismatched private/public pair.
   *
   * Caller is responsible for archiving the OLD public key as a fallback BEFORE
   * invoking this (so JWKS verification of in-flight tokens keeps working).
   */
  static generateAndRotateKeys(): { privateKey: string; publicKey: string } {
    this.logger.log('Rotating RSA-2048 key pair...');

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const secretsDir = path.dirname(this.PRIVATE_KEY_PATH);
    if (!fs.existsSync(secretsDir)) {
      fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
    }

    const privateTmp = `${this.PRIVATE_KEY_PATH}.tmp`;
    const publicTmp = `${this.PUBLIC_KEY_PATH}.tmp`;

    try {
      fs.writeFileSync(privateTmp, privateKey, { mode: 0o600 });
      fs.writeFileSync(publicTmp, publicKey, { mode: 0o644 });
      // POSIX rename is atomic — either both files are the new pair, or both
      // are still the old pair. No partial state.
      fs.renameSync(privateTmp, this.PRIVATE_KEY_PATH);
      fs.renameSync(publicTmp, this.PUBLIC_KEY_PATH);
    } catch (err) {
      // Best-effort cleanup of any tmp file left behind.
      for (const tmp of [privateTmp, publicTmp]) {
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* ignore */ }
      }
      throw err;
    }

    this.logger.log('RSA keys rotated and persisted atomically.');
    return { privateKey, publicKey };
  }
}
