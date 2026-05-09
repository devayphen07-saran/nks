import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PasswordService } from './password.service';
import { PasswordBreachCheckService } from './password-breach-check.service';
import { BadRequestException } from '@nestjs/common';

const VALID_PASSWORD = 'StrongPass1!';

const buildModule = async (configured: number): Promise<PasswordService> => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PasswordService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((_: string, fallback: number) => configured ?? fallback),
        },
      },
      {
        provide: PasswordBreachCheckService,
        useValue: { assertNotBreached: jest.fn().mockResolvedValue(undefined) },
      },
    ],
  }).compile();
  return module.get<PasswordService>(PasswordService);
};

describe('PasswordService', () => {
  describe('bcrypt rounds clamping', () => {
    it('uses configured value when within [10, 14]', async () => {
      const service = await buildModule(13);
      const hash = await service.hash(VALID_PASSWORD);
      expect(hash.startsWith('$2b$13$')).toBe(true);
    });

    it('clamps below to 10 when configured is too low', async () => {
      const service = await buildModule(5);
      const hash = await service.hash(VALID_PASSWORD);
      expect(hash.startsWith('$2b$10$')).toBe(true);
    });

    it('clamps above to 14 when configured is too high', async () => {
      const service = await buildModule(20);
      const hash = await service.hash(VALID_PASSWORD);
      expect(hash.startsWith('$2b$14$')).toBe(true);
    }, 30_000);
  });

  describe('hash', () => {
    let service: PasswordService;
    beforeEach(async () => { service = await buildModule(10); });

    it('produces a bcrypt hash for a valid password', async () => {
      const hash = await service.hash(VALID_PASSWORD);
      expect(hash).toMatch(/^\$2[ayb]\$/);
    });

    it('produces a different hash on each call (random salt)', async () => {
      const a = await service.hash(VALID_PASSWORD);
      const b = await service.hash(VALID_PASSWORD);
      expect(a).not.toBe(b);
    });

    it('throws BadRequestException for a weak password', async () => {
      await expect(service.hash('weak')).rejects.toThrow(BadRequestException);
    });
  });

  describe('compare', () => {
    let service: PasswordService;
    beforeEach(async () => { service = await buildModule(10); });

    it('returns true for a matching password and hash', async () => {
      const hash = await bcrypt.hash(VALID_PASSWORD, 10);
      expect(await service.compare(VALID_PASSWORD, hash)).toBe(true);
    });

    it('returns false for a non-matching password', async () => {
      const hash = await bcrypt.hash(VALID_PASSWORD, 10);
      expect(await service.compare('WrongPass1!@', hash)).toBe(false);
    });
  });

  describe('validateStrength', () => {
    let service: PasswordService;
    beforeEach(async () => { service = await buildModule(10); });

    it('does not throw for a strong password', () => {
      expect(() => service.validateStrength(VALID_PASSWORD)).not.toThrow();
    });

    it('throws BadRequestException for a weak password', () => {
      expect(() => service.validateStrength('weak')).toThrow(BadRequestException);
    });
  });
});