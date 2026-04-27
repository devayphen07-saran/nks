import { Injectable } from '@nestjs/common';
import { PasswordAuthService } from '../services/flows/password-auth.service';
import type { LoginDto, RegisterDto } from '../dto';
import type { AuthControllerHelpers } from '../../../../common/utils/auth-helpers';

type DeviceInfo = ReturnType<typeof AuthControllerHelpers.extractDeviceInfo>;

/**
 * Orchestrates password-based auth flows (login, register).
 * Controller extracts device info from the HTTP request and passes it here.
 */
@Injectable()
export class AuthFlowUseCase {
  constructor(private readonly passwordAuth: PasswordAuthService) {}

  login(dto: LoginDto, deviceInfo: DeviceInfo) {
    return this.passwordAuth.login(dto, deviceInfo);
  }

  register(dto: RegisterDto, deviceInfo: DeviceInfo) {
    return this.passwordAuth.register(dto, deviceInfo);
  }
}
