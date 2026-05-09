import { Test, TestingModule } from '@nestjs/testing';
import { AuthFlowOrchestratorService, AuthUserContext } from './auth-flow-orchestrator.service';
import { SessionBootstrapService } from '../session/session-bootstrap.service';
import { TokenService } from '../token/token.service';

const baseUser: AuthUserContext = {
  id: 42,
  guuid: 'user-guuid',
  iamUserId: 'iam-user-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  image: null,
  phoneNumber: null,
  phoneNumberVerified: false,
  defaultStoreFk: null,
};

const fakeSession = {
  token: 'session-token',
  sessionGuuid: 'session-guuid',
  jti: 'jti-1',
  csrfSecret: 'csrf-secret',
  expiresAt: new Date(Date.now() + 3_600_000),
  userRoles: [{ roleCode: 'ADMIN', storeId: null }],
  userEmail: 'ada@example.com',
  permissions: { roles: [{ roleCode: 'ADMIN', storeId: null }] },
};

const fakeTokenPair = {
  accessToken: 'access-jwt',
  refreshToken: 'refresh-token',
  jwtExpiresAt: new Date(),
  refreshTokenExpiresAt: new Date(),
};

const fakeEnvelope = { user: {}, auth: {}, context: {} } as any;

describe('AuthFlowOrchestratorService', () => {
  let service: AuthFlowOrchestratorService;
  let bootstrap: { createForUser: jest.Mock };
  let tokens: { createTokenPair: jest.Mock; buildAuthResponse: jest.Mock };

  beforeEach(async () => {
    bootstrap = { createForUser: jest.fn().mockResolvedValue(fakeSession) };
    tokens = {
      createTokenPair: jest.fn().mockResolvedValue(fakeTokenPair),
      buildAuthResponse: jest.fn().mockResolvedValue(fakeEnvelope),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthFlowOrchestratorService,
        { provide: SessionBootstrapService, useValue: bootstrap },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();

    service = module.get<AuthFlowOrchestratorService>(AuthFlowOrchestratorService);
  });

  it('returns envelope and csrfSecret on the happy path', async () => {
    const result = await service.execute(baseUser, undefined);
    expect(result.envelope).toBe(fakeEnvelope);
    expect(result.csrfSecret).toBe('csrf-secret');
  });

  it('passes user.id and deviceInfo to bootstrap', async () => {
    const deviceInfo = { deviceId: 'd-1', deviceType: 'IOS' } as any;
    await service.execute(baseUser, deviceInfo);
    expect(bootstrap.createForUser).toHaveBeenCalledWith(42, deviceInfo);
  });

  it('forwards session and user fields to createTokenPair in the expected order', async () => {
    await service.execute(baseUser, undefined);
    expect(tokens.createTokenPair).toHaveBeenCalledWith(
      'user-guuid',
      'session-token',
      fakeSession.userRoles,
      'ada@example.com',
      'session-guuid',
      'jti-1',
      'iam-user-1',
      'Ada',
      'Lovelace',
    );
  });

  it('passes 6 arguments (not 7) to buildAuthResponse', async () => {
    await service.execute(baseUser, { deviceId: 'd-1' } as any);
    const args = tokens.buildAuthResponse.mock.calls[0];
    expect(args).toHaveLength(6);
    expect(args[0]).toBe(baseUser);
    expect(args[5]).toBe(fakeSession.permissions);
  });

  it('propagates bootstrap failure without calling token methods', async () => {
    bootstrap.createForUser.mockRejectedValue(new Error('session create failed'));
    await expect(service.execute(baseUser, undefined)).rejects.toThrow('session create failed');
    expect(tokens.createTokenPair).not.toHaveBeenCalled();
    expect(tokens.buildAuthResponse).not.toHaveBeenCalled();
  });

  it('propagates token-pair failure without calling buildAuthResponse', async () => {
    tokens.createTokenPair.mockRejectedValue(new Error('token gen failed'));
    await expect(service.execute(baseUser, undefined)).rejects.toThrow('token gen failed');
    expect(tokens.buildAuthResponse).not.toHaveBeenCalled();
  });
});
