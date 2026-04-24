import { registerAs } from '@nestjs/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. MSG91 OTP calls cannot be made without it.`,
    );
  }
  return value;
}

export default registerAs('msg91', () => ({
  authKey: requireEnv('MSG91_AUTH_KEY'),
  widgetId: requireEnv('MSG91_WIDGET_ID'),
  baseUrl:
    process.env.MSG91_BASE_URL || 'https://control.msg91.com/api/v5/widget',
}));
