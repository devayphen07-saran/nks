/**
 * In-memory OTP session store.
 *
 * Keeps reqId out of the navigation URL so it does not appear in
 * Expo Router's navigation history or device screenshots.
 *
 * Lifecycle: set by usePhoneAuth after a successful sendOtp call,
 * cleared by useOtpVerify after successful verification or explicit reset.
 */

let _reqId = "";
let _phone = "";

export function setPendingOtpSession(phone: string, reqId: string): void {
  _phone = phone;
  _reqId = reqId;
}

export function getPendingOtpSession(): { phone: string; reqId: string } {
  return { phone: _phone, reqId: _reqId };
}

export function clearPendingOtpSession(): void {
  _phone = "";
  _reqId = "";
}
