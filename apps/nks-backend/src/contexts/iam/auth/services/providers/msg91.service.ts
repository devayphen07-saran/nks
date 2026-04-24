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

/** Hard cap on outbound MSG91 requests. Keeps the event loop responsive when
 *  the provider is slow or unreachable. */
const MSG91_REQUEST_TIMEOUT_MS = 5000;

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);
  private readonly authKey: string;
  private readonly widgetId: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    // getOrThrow fails fast at startup if MSG91 credentials are missing,
    // instead of sending `authkey: undefined` on every request in prod.
    this.authKey = this.configService.getOrThrow<string>('msg91.authKey');
    this.widgetId = this.configService.getOrThrow<string>('msg91.widgetId');
    this.baseUrl = this.configService.getOrThrow<string>('msg91.baseUrl');
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

  private async post(path: string, body: Record<string, unknown>): Promise<Msg91Response> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MSG91_REQUEST_TIMEOUT_MS);

    try {
      // Never log the body: it can contain OTP codes and reqIds that are
      // usable credentials until consumed. Log only the path.
      this.logger.log(`MSG91 ${path} → request`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: this.authKey,
        },
        body: JSON.stringify({ ...body, widgetId: this.widgetId }),
        signal: controller.signal,
      });

      const data = (await response.json()) as Msg91Response;

      // Log status + type only — never the payload.
      if (!response.ok || data.type === 'error') {
        this.logger.error(`MSG91 ${path} failed (${response.status}) type=${data?.type ?? 'unknown'}`);
      } else {
        this.logger.log(`MSG91 ${path} → ${response.status}`);
      }
      return data;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        this.logger.error(`MSG91 ${path} timed out after ${MSG91_REQUEST_TIMEOUT_MS}ms`);
      } else {
        this.logger.error(`MSG91 ${path} error: ${(error as Error).message}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
