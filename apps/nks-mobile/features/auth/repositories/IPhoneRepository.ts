/**
 * Phone authentication repository interface
 * Defines the contract for phone-related API operations
 */

export interface SendOtpRequest {
  phone: string; // Full phone number with country code, e.g., "+919025863606"
}

export interface SendOtpResponse {
  reqId: string; // Request ID for OTP verification
  message?: string;
}

export interface IPhoneRepository {
  /**
   * Send OTP to phone number
   * @param request Phone number to send OTP to
   * @returns Request ID for OTP verification
   * @throws AppError if request fails
   */
  sendOtp(request: SendOtpRequest): Promise<SendOtpResponse>;
}
