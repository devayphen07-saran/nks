import { ConfigService } from '@nestjs/config';
import { PasswordBreachCheckService } from './password-breach-check.service';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '../../../../../common/exceptions';
import { ErrorCode } from '../../../../../common/constants/error-codes.constants';

const SHA1_PREFIX_LEN = 5;

const sha1Suffix = (password: string): string => {
  // Mirror the prod path so we can build a realistic HIBP response.
  const crypto = require('crypto') as typeof import('crypto');
  return crypto
    .createHash('sha1')
    .update(password)
    .digest('hex')
    .toUpperCase()
    .slice(SHA1_PREFIX_LEN);
};

const buildHibpResponse = (suffix: string, count = 12345): string =>
  `${suffix}:${count}\nDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEAD:1`;

describe('PasswordBreachCheckService (fail-closed)', () => {
  let service: PasswordBreachCheckService;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    const config = {
      get: (_key: string, fallback: string) => fallback ?? 'true',
    } as unknown as ConfigService;
    service = new PasswordBreachCheckService(config);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns BREACHED and assertNotBreached throws 400 when HIBP confirms a hit', async () => {
    const password = 'password123';
    const suffix = sha1Suffix(password);
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(buildHibpResponse(suffix)),
    } as unknown as Response);

    await expect(service.checkBreach(password)).resolves.toBe('BREACHED');

    const promise = service.assertNotBreached(password);
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toMatchObject({
      code: ErrorCode.AUTH_PASSWORD_BREACHED,
    });
  });

  it('returns NOT_BREACHED and assertNotBreached resolves when HIBP returns no match', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:1'),
    } as unknown as Response);

    await expect(service.checkBreach('correct horse battery staple')).resolves.toBe('NOT_BREACHED');
    await expect(service.assertNotBreached('correct horse battery staple')).resolves.toBeUndefined();
  });

  it('returns UNAVAILABLE and assertNotBreached throws 503 when HIBP is unreachable (network error)', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

    await expect(service.checkBreach('any-password')).resolves.toBe('UNAVAILABLE');

    const promise = service.assertNotBreached('any-password');
    await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(promise).rejects.toMatchObject({
      code: ErrorCode.AUTH_PASSWORD_BREACH_CHECK_UNAVAILABLE,
    });
  });

  it('returns UNAVAILABLE when HIBP responds with a non-2xx status', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(''),
    } as unknown as Response);

    await expect(service.checkBreach('any-password')).resolves.toBe('UNAVAILABLE');
  });

  it('honors HIBP_BREACH_CHECK_ENABLED=false and resolves to NOT_BREACHED without calling fetch', async () => {
    const fetchSpy = jest.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const config = {
      get: (key: string, fallback: string) =>
        key === 'HIBP_BREACH_CHECK_ENABLED' ? 'false' : fallback,
    } as unknown as ConfigService;
    const disabled = new PasswordBreachCheckService(config);

    await expect(disabled.checkBreach('any-password')).resolves.toBe('NOT_BREACHED');
    await expect(disabled.assertNotBreached('any-password')).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logs a structured event when HIBP is unavailable (for metric scraping)', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));

    const errorSpy = jest.spyOn((service as unknown as { logger: { error: jest.Mock } }).logger, 'error').mockImplementation(() => undefined);

    await service.checkBreach('any-password');

    expect(errorSpy).toHaveBeenCalled();
    const [logCtx] = errorSpy.mock.calls[0];
    expect(logCtx).toMatchObject({ event: 'password_breach_check_unavailable' });
  });
});
