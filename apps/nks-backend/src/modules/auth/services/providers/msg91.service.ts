import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MSG91 API Response
 * All MSG91 endpoints return a response with type, message, and optional reqId/data
 */
export interface Msg91Response {
  type: 'success' | 'error';
  message: string;
  reqId?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);
  private readonly authKey: string;
  private readonly widgetId: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.authKey = this.configService.get<string>('msg91.authKey') as string;
    this.widgetId = this.configService.get<string>('msg91.widgetId') as string;
    this.baseUrl = this.configService.get<string>('msg91.baseUrl') as string;
  }

  /**
   * Send OTP to the given identifier.
   */
  async sendOtp(identifier: string): Promise<Msg91Response> {
    return this.post('/sendOtp', { identifier });
  }

  /**
   * Verify the OTP for a given identifier.
   * Note: The SDK documentation says it takes 'otp', but usually it needs the identifier too or a requestId.
   * Based on the user-provided snippet: { otp: otpValue } was passed to /verifyOtp.
   * However, most APIs require the identifier to know which OTP to verify.
   */
  async verifyOtp(reqId: string, otp: string): Promise<Msg91Response> {
    return this.post('/verifyOtp', { reqId, otp });
  }

  /**
   * Resend OTP using the original request ID.
   */
  async resendOtp(reqId: string, channel: string = '11'): Promise<Msg91Response> {
    return this.post('/retryOtp', { reqId, channel });
  }

  private async post(path: string, body: Record<string, any>): Promise<Msg91Response> {
    try {
      const url = `${this.baseUrl}${path}`;
      const payload = { ...body, widgetId: this.widgetId };
      this.logger.log(
        `MSG91 ${path} request to ${url} with ${JSON.stringify(payload)}`,
      );
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: this.authKey,
        },
        body: JSON.stringify({
          ...body,
          widgetId: this.widgetId,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.type === 'error') {
        this.logger.error(
          `MSG91 ${path} failed (${response.status}): ${JSON.stringify(data)}`,
        );
      } else {
        this.logger.log(`MSG91 ${path} success: ${JSON.stringify(data)}`);
      }
      return data;
    } catch (error) {
      this.logger.error(`MSG91 ${path} error: ${error.message}`);
      throw error;
    }
  }
}
