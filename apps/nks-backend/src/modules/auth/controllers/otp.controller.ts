import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { OtpService } from '../services/otp.service';
import { SendOtpDto, VerifyOtpDto } from '../dto/otp.dto';
import { VerifyEmailOtpDto } from '../dto/email-verify.dto';
import { ApiResponse } from '../../../common/utils/api-response';
import { AuthGuard } from '../../../common/guards/auth.guard';

@ApiTags('Auth')
@Controller('auth/otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP via MSG91 (Server-side)' })
  @SwaggerResponse({ status: 200, description: 'OTP sent successfully' })
  async sendOtp(@Body() dto: SendOtpDto) {
    const result = await this.otpService.sendOtp(dto);
    return ApiResponse.ok(result, 'OTP sent successfully');
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and Login (Server-side)' })
  @SwaggerResponse({
    status: 200,
    description: 'OTP verified and login successful',
  })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const result = await this.otpService.verifyOtp(dto);
    return ApiResponse.ok(result, 'Login successful');
  }

  @Post('retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry sending OTP' })
  async retryOtp() {
    const result = await this.otpService.retryOtp();
    return ApiResponse.ok(result, 'OTP resend triggered');
  }

  @Post('email/send')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Send OTP to email during onboarding (authenticated user)',
  })
  async sendEmailOtp(@Body() dto: { email: string }) {
    await this.otpService.sendEmailOtp(dto.email);
    return ApiResponse.ok(null, 'OTP sent to email');
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Verify email OTP and mark email as verified',
  })
  async verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    await this.otpService.verifyEmailOtp(dto);
    return ApiResponse.ok(null, 'Email verified successfully');
  }
}
