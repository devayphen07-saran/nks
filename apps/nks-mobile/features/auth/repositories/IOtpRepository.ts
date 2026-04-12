/**
 * OTP authentication repository interface
 * Defines the contract for OTP-related API operations
 */

export interface VerifyOtpRequest {
  phone: string; // Full phone number with country code
  otp: string; // 6-digit OTP
  reqId: string; // Request ID from sendOtp response
}

export interface AuthResponse {
  data: {
    session: {
      sessionToken: string;
      refreshToken: string;
      expiresAt: string;
      refreshExpiresAt: string;
    };
    user: {
      id: string;
      email?: string;
      phoneNumber: string;
      name?: string;
    };
  };
}

export interface VerifyOtpResponse extends AuthResponse {
  message?: string;
}

export interface ResendOtpRequest {
  reqId: string;
}

export interface ResendOtpResponse {
  reqId: string;
  message?: string;
}

export interface IOtpRepository {
  /**
   * Verify OTP and authenticate user
   * @param request OTP verification details
   * @returns Auth response with session token
   * @throws AppError if verification fails
   */
  verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResponse>;

  /**
   * Resend OTP to phone number
   * @param request Resend request with previous reqId
   * @returns New request ID
   * @throws AppError if resend fails
   */
  resendOtp(request: ResendOtpRequest): Promise<ResendOtpResponse>;
}
