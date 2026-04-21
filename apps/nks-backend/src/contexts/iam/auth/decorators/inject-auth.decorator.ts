import { Inject } from '@nestjs/common';
import { BETTER_AUTH_TOKEN } from '../auth.constants';

/**
 * Custom decorator to inject the BetterAuth instance.
 * Usage: constructor(@InjectAuth() private readonly auth: Auth) {}
 */
export const InjectAuth = () => Inject(BETTER_AUTH_TOKEN);
