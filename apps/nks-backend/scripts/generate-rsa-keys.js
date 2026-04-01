#!/usr/bin/env node

/**
 * RSA Key Generation Script
 * Generates RSA-2048 key pair for JWT signing (RS256)
 *
 * Usage: npm run generate:jwt-keys
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRIVATE_KEY_PATH = path.join(process.cwd(), 'secrets/jwt_rsa_private.pem');
const PUBLIC_KEY_PATH = path.join(process.cwd(), 'secrets/jwt_rsa_public.pem');

function generateKeyPair() {
  console.log('🔐 Generating RSA-2048 key pair...');

  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Create secrets directory
    const secretsDir = path.dirname(PRIVATE_KEY_PATH);
    if (!fs.existsSync(secretsDir)) {
      fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
      console.log(`✅ Created secrets directory: ${secretsDir}`);
    }

    // Write keys
    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });

    console.log('✅ RSA keys generated successfully');
    console.log(`   Private: ${PRIVATE_KEY_PATH} (mode: 0600)`);
    console.log(`   Public:  ${PUBLIC_KEY_PATH} (mode: 0644)`);
    console.log('\n📝 Add to .gitignore:');
    console.log('   secrets/');
    console.log('\n✨ Keys are ready for use');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to generate RSA keys:', error.message);
    process.exit(1);
  }
}

generateKeyPair();
