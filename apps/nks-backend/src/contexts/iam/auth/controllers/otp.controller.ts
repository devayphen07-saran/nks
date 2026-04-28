import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OtpService } from '../services/otp/otp.service';
import { OtpAuthOrchestrator } from '../services/orchestrators/otp-auth-orchestrator.service';
import { CsrfService } from '../../../../common/csrf.service';
import { AuthControllerHelpers } from '../../../../common/utils/auth-helpers';
import { SendOtpDto, VerifyOtpDto, ResendOtpDto } from '../dto/otp.dto';
import { VerifyEmailOtpDto } from '../dto/email-verify.dto';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../../common/decorators/response-message.decorator';
import type { SessionUser } from '../interfaces/session-user.interface';
import {
  SendOtpResponseDto,
  ResendOtpResponseDto,
} from '../dto/otp-response.dto';
import { Public } from '../../../../common/decorators/public.decorator';
import { RateLimit } from '../../../../common/decorators/rate-limit.decorator';
import type { AuthResponseEnvelope } from '../dto';

@ApiTags('Auth')
@Controller('auth/otp')
export class OtpController {
  constructor(
    private readonly otpService: OtpService,
    private readonly otpAuthOrchestrator: OtpAuthOrchestrator,
    private readonly csrf: CsrfService,
  ) {}

  @Post('send')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(3)
  @ResponseMessage('OTP sent successfully')
  @ApiOperation({ summary: 'Send OTP via MSG91' })
  async sendOtp(@Body() dto: SendOtpDto): Promise<SendOtpResponseDto> {
    return this.otpService.sendOtp(dto);
  }

  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(5)
  @ResponseMessage('Login successful')
  @ApiOperation({ summary: 'Verify OTP and login' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseEnvelope> {
    const deviceInfo = AuthControllerHelpers.extractDeviceInfo(req);
    const result = await this.otpAuthOrchestrator.verifyOtpAndBuildAuthResponse(dto, deviceInfo);

    AuthControllerHelpers.applySessionCookie(res, result);
    if (result.auth?.sessionToken && !AuthControllerHelpers.isMobile(deviceInfo.deviceType)) {
      this.csrf.refresh(req, res, result.auth.sessionToken);
    }
    return AuthControllerHelpers.forClient(result, deviceInfo.deviceType);
  }

  @Post('resend')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(3)
  @ResponseMessage('OTP resent successfully')
  @ApiOperation({ summary: 'Resend OTP using original request ID' })
  async resendOtp(@Body() dto: ResendOtpDto): Promise<ResendOtpResponseDto> {
    return this.otpService.resendOtp(dto.reqId);
  }

  @Post('email/send')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @RateLimit(3)
  @ResponseMessage('OTP sent to email')
  @ApiOperation({
    summary: 'Send OTP to email during onboarding (authenticated user)',
  })
  async sendEmailOtp(@CurrentUser() user: SessionUser): Promise<null> {
    await this.otpService.sendEmailOtp(user.email);
    return null;
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @RateLimit(5)
  @ResponseMessage('Email verified successfully')
  @ApiOperation({
    summary: 'Verify email OTP and mark email as verified',
  })
  async verifyEmailOtp(@Body() dto: VerifyEmailOtpDto): Promise<null> {
    await this.otpService.verifyEmailOtp(dto);
    return null;
  }
}
