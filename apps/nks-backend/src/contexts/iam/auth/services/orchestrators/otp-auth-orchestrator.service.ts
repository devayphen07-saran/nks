import { Injectable } from '@nestjs/common';
import { OtpService } from '../otp/otp.service';
import { UserCreationService } from '../flows/user-creation.service';
import { SessionCommandService } from '../session/session-command.service';
import { TokenService } from '../token/token.service';
import { executeAuthFlow } from './auth-flow-orchestrator.service';
import { VerifyOtpDto } from '../../dto/otp.dto';
import type { AuthResponseEnvelope } from '../../dto';

@Injectable()
export class OtpAuthOrchestrator {
  constructor(
    private readonly otpService: OtpService,
    private readonly userCreationService: UserCreationService,
    private readonly sessionService: SessionCommandService,
    private readonly tokenService: TokenService,
  ) {}

  async verifyOtpAndBuildAuthResponse(
    dto: VerifyOtpDto,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      appVersion?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<AuthResponseEnvelope> {
    await this.otpService.verifyOtp(dto);
    const user = await this.userCreationService.findOrCreateByPhone(dto.phone);
    return executeAuthFlow(user, deviceInfo, this.sessionService, this.tokenService);
  }
}
