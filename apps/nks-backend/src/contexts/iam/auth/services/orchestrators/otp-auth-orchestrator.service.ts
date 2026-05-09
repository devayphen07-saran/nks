import { Injectable, Logger } from '@nestjs/common';
import { OtpService } from '../otp/otp.service';
import { UserCreationService } from '../flows/user-creation.service';
import { AuthFlowOrchestratorService } from './auth-flow-orchestrator.service';
import { VerifyOtpDto } from '../../dto/otp.dto';
import type { AuthResponseEnvelope } from '../../dto';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

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
    deviceInfo?: DeviceInfo,
  ): Promise<{ envelope: AuthResponseEnvelope; csrfSecret: string }> {
    await this.otpService.verifyOtp(dto);
    const user = await this.userCreationService.findOrCreateByPhone(dto.phone);
    return this.authFlow.execute(user, deviceInfo);
  }
}
