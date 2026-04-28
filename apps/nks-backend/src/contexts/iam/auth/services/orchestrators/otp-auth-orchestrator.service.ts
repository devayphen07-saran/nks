import { Injectable, Logger } from '@nestjs/common';
import { OtpService } from '../otp/otp.service';
import { UserCreationService } from '../flows/user-creation.service';
import { AuthFlowOrchestratorService } from './auth-flow-orchestrator.service';
import { VerifyOtpDto } from '../../dto/otp.dto';
import type { AuthResponseEnvelope } from '../../dto';

@Injectable()
export class OtpAuthOrchestrator {
  private readonly logger = new Logger(OtpAuthOrchestrator.name);

  constructor(
    private readonly otpService: OtpService,
    private readonly userCreationService: UserCreationService,
    private readonly authFlow: AuthFlowOrchestratorService,
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
    return this.authFlow.execute(user, deviceInfo);
  }
}
