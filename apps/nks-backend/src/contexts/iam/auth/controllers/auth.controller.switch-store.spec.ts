import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { PasswordAuthService } from '../services/flows/password-auth.service';
import { TokenLifecycleService } from '../services/token/token-lifecycle.service';
import { AuthQueryService } from '../services/session/auth-query.service';
import { SessionCommandService } from '../services/session/session-command.service';
import { SessionQueryService } from '../services/session/session-query.service';
import { OnboardingService } from '../services/flows/onboarding.service';
import { PermissionsService } from '../services/permissions/permissions.service';
import { DeviceRegistrationFlowService } from '../services/device/device-registration-flow.service';
import { JWTConfigService } from '../../../../config/jwt.config';
import { CsrfService } from '../../../../common/csrf.service';
import { ForbiddenException } from '../../../../common/exceptions';
import { ErrorCode } from '../../../../common/constants/error-codes.constants';
import type { SessionUser } from '../interfaces/session-user.interface';
import type { DeviceContext } from '../../../../common/decorators/device-context.decorator';

/**
 * Tenant-isolation regression: switchStore must reject store ids the user
 * is not a member of. Cashier in Store A calling /auth/switch-store with
 * Store B's id → 403 AUTH_FORBIDDEN_STORE_ACCESS, and the device-registration
 * flow is never invoked.
 */
describe('AuthController.switchStore (tenant isolation)', () => {
  let controller: AuthController;
  let permissions: { findActiveStoreIds: jest.Mock };
  let deviceRegistrationFlow: { switchActiveStore: jest.Mock };

  const cashier: SessionUser = {
    userId: 42,
    sessionId: 7,
    activeStoreId: 100,
    isSuperAdmin: false,
    roles: [],
    deviceId: 'dev-1',
  } as unknown as SessionUser;

  const device: DeviceContext = {
    deviceId: 'dev-1',
    deviceType: 'mobile',
  } as unknown as DeviceContext;

  beforeEach(async () => {
    permissions = {
      findActiveStoreIds: jest.fn(),
    };
    deviceRegistrationFlow = {
      switchActiveStore: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: PasswordAuthService, useValue: {} },
        { provide: TokenLifecycleService, useValue: {} },
        { provide: AuthQueryService, useValue: {} },
        { provide: SessionCommandService, useValue: {} },
        { provide: SessionQueryService, useValue: {} },
        { provide: OnboardingService, useValue: {} },
        { provide: PermissionsService, useValue: permissions },
        { provide: JWTConfigService, useValue: {} },
        { provide: CsrfService, useValue: {} },
        { provide: DeviceRegistrationFlowService, useValue: deviceRegistrationFlow },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('rejects switch into a non-member store with 403 AUTH_FORBIDDEN_STORE_ACCESS', async () => {
    // Cashier is a member of Store 100 only. Tries to switch into Store 200.
    permissions.findActiveStoreIds.mockResolvedValue([100]);

    const promise = controller.switchStore({ storeId: 200 }, cashier, device);

    await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
    await expect(promise).rejects.toMatchObject({
      code: ErrorCode.AUTH_FORBIDDEN_STORE_ACCESS,
    });

    // Critically: the session mutation must NOT have been issued.
    expect(deviceRegistrationFlow.switchActiveStore).not.toHaveBeenCalled();
  });

  it('allows switch into a store the user is a member of', async () => {
    permissions.findActiveStoreIds.mockResolvedValue([100, 200]);

    const result = await controller.switchStore({ storeId: 200 }, cashier, device);

    expect(result).toEqual({ success: true, activeStoreId: 200 });
    expect(deviceRegistrationFlow.switchActiveStore).toHaveBeenCalledWith(
      cashier.sessionId,
      200,
      device.deviceId,
    );
  });

  it('rejects when user has no store memberships at all', async () => {
    permissions.findActiveStoreIds.mockResolvedValue([]);

    await expect(
      controller.switchStore({ storeId: 100 }, cashier, device),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(deviceRegistrationFlow.switchActiveStore).not.toHaveBeenCalled();
  });
});
