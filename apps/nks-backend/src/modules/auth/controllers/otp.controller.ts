import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OtpService } from '../services/otp.service';
import { AuthControllerHelpers } from '../../../common/utils/auth-helpers';
import { SendOtpDto, VerifyOtpDto, ResendOtpDto } from '../dto/otp.dto';
import { SendEmailOtpDto, VerifyEmailOtpDto } from '../dto/email-verify.dto';
import { SendOtpResponseDto, ResendOtpResponseDto } from '../dto/otp-response.dto';
import { ApiResponse } from '../../../common/utils/api-response';
import { AuthGuard } from '../../../common/guards/auth.guard';
import type { AuthResponseEnvelope } from '../dto';

@ApiTags('Auth')
@Controller('auth/otp')
export class OtpController {
  private readonly logger = new Logger(OtpController.name);

  constructor(private readonly otpService: OtpService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP via MSG91' })
  async sendOtp(@Body() dto: SendOtpDto): Promise<ApiResponse<SendOtpResponseDto>> {
    const result = await this.otpService.sendOtp(dto);
    return ApiResponse.ok(result, 'OTP sent successfully');
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and login' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<AuthResponseEnvelope>> {
    const deviceInfo = AuthControllerHelpers.extractDeviceInfo(req);
    const result = await this.otpService.verifyOtp(dto, deviceInfo);

    // Only set httpOnly cookie for web clients
    // Mobile clients don't use cookies - they use JWT tokens
    if (!deviceInfo.deviceType || deviceInfo.deviceType === 'WEB') {
      AuthControllerHelpers.applySessionCookie(res, result);
      this.logger.debug('[OTP] Session cookie set for WEB client');
    } else {
      this.logger.debug(`[OTP] Skipped session cookie for ${deviceInfo.deviceType} client (uses JWT)`);
    }

    return ApiResponse.ok(result, 'Login successful');
  }

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend OTP using original request ID' })
  async resendOtp(@Body() dto: ResendOtpDto): Promise<ApiResponse<ResendOtpResponseDto>> {
    const result = await this.otpService.resendOtp(dto.reqId);
    return ApiResponse.ok(result, 'OTP resent successfully');
  }

  @Post('email/send')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send OTP to email during onboarding (authenticated user)',
  })
  async sendEmailOtp(@Body() dto: SendEmailOtpDto) {
    await this.otpService.sendEmailOtp(dto.email);
    return ApiResponse.ok(null, 'OTP sent to email');
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify email OTP and mark email as verified',
  })
  async verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    await this.otpService.verifyEmailOtp(dto);
    return ApiResponse.ok(null, 'Email verified successfully');
  }

}
