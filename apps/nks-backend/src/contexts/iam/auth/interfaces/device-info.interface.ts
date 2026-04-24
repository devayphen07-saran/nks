/**
 * Device fingerprint passed through the authentication pipeline.
 *
 * Collected once per request by AuthControllerHelpers.extractDeviceInfo and
 * threaded through: PasswordAuthService → AuthFlowOrchestrator → SessionService.
 * All fields are optional — mobile clients supply device-specific values,
 * web clients may omit them.
 */
export interface DeviceInfo {
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  /** Mobile OS platform string (e.g. 'ios', 'android'). Not present for web clients. */
  platform?: string;
  appVersion?: string;
  ipAddress?: string;
  userAgent?: string;
}
