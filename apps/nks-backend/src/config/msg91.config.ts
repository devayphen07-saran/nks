import { registerAs } from '@nestjs/config';

export default registerAs('msg91', () => ({
  authKey: process.env.MSG91_AUTH_KEY,
  widgetId: process.env.MSG91_WIDGET_ID,
  baseUrl:
    process.env.MSG91_BASE_URL || 'https://control.msg91.com/api/v5/widget',
}));
