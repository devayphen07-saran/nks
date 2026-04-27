import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from './env.validation';

// MSG91_AUTH_KEY, MSG91_WIDGET_ID, MSG91_BASE_URL are all validated and
// required by envSchema — getValidatedEnv() guarantees they are present.
export default registerAs('msg91', () => {
  const env = getValidatedEnv();
  return {
    authKey: env.MSG91_AUTH_KEY,
    widgetId: env.MSG91_WIDGET_ID,
    baseUrl: env.MSG91_BASE_URL,
  };
});
