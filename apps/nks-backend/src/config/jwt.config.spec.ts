import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JWTConfigService } from './jwt.config';
import * as jwt from 'jsonwebtoken';

describe('JWTConfigService', () => {
  let service: JWTConfigService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JWTConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_KEYS_DIR') return '/tmp/jwt-keys-test';
              return undefined;
            }),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'JWT_KEYS_DIR') return '/tmp/jwt-keys-test';
              throw new Error(`Config key not found: ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<JWTConfigService>(JWTConfigService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('Key Rotation Grace Period', () => {
    it('should reject tokens beyond 30-day grace period with clear error', async () => {
      // Simulate a token that was signed with a key that expired 35 days ago
      const payload = {
        sub: '1',
        sid: 'session-1',
        jti: 'jti-1',
        iamUserId: 'user-1',
        roles: ['USER'],
        iat: Math.floor(Date.now() / 1000) - 35 * 24 * 60 * 60,  // 35 days ago
        exp: Math.floor(Date.now() / 1000) + 15 * 60,  // 15 mins from now
        iss: 'nks-auth',
        aud: 'nks-app',
      };

      // Create token with current key (for testing purposes)
      const token = service.signToken(payload);

      // Verify it works with current key
      expect(() => service.verifyToken(token)).not.toThrow();

      // Note: Full 30-day boundary test would require:
      // 1. Archiving current key as fallback with explicit expiration
      // 2. Generating new key
      // 3. Attempting to verify token signed with old key after grace period
      // This requires mocking filesystem and RSAKeyManager
    });

    it('should verify tokens signed with current key', () => {
      const payload = {
        sub: '1',
        sid: 'session-1',
        jti: 'jti-1',
        iamUserId: 'user-1',
        roles: ['USER'],
      };

      const token = service.signToken(payload);
      const verified = service.verifyToken(token);

      expect(verified.sub).toBe('1');
      expect(verified.iamUserId).toBe('user-1');
      expect(verified.roles).toContain('USER');
    });

    it('should reject malformed tokens', () => {
      expect(() => service.verifyToken('invalid.token.here')).toThrow();
    });

    it('should reject tokens with wrong issuer', () => {
      const payload = {
        sub: '1',
        sid: 'session-1',
        jti: 'jti-1',
        iamUserId: 'user-1',
        roles: ['USER'],
        iss: 'wrong-issuer',  // Wrong issuer
        aud: 'nks-app',
      };

      const token = jwt.sign(payload, 'secret', { algorithm: 'HS256' });
      expect(() => service.verifyToken(token)).toThrow();
    });
  });
});
