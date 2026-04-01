import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class RSAKeyManager {
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
    console.log('🔐 Generating RSA-2048 key pair...');

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Create secrets directory
    const secretsDir = path.dirname(this.PRIVATE_KEY_PATH);
    if (!fs.existsSync(secretsDir)) {
      fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
    }

    // Write keys
    fs.writeFileSync(this.PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
    fs.writeFileSync(this.PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });

    console.log('✅ RSA keys generated');
    console.log(`   Private: ${this.PRIVATE_KEY_PATH} (mode: 0600)`);
    console.log(`   Public:  ${this.PUBLIC_KEY_PATH} (mode: 0644)`);
  }

  static getPrivateKey(): string {
    if (!fs.existsSync(this.PRIVATE_KEY_PATH)) {
      throw new Error(`Private key not found. Run: npm run generate:jwt-keys`);
    }
    return fs.readFileSync(this.PRIVATE_KEY_PATH, 'utf8');
  }

  static getPublicKey(): string {
    if (!fs.existsSync(this.PUBLIC_KEY_PATH)) {
      throw new Error(`Public key not found. Run: npm run generate:jwt-keys`);
    }
    return fs.readFileSync(this.PUBLIC_KEY_PATH, 'utf8');
  }
}
