import { Injectable } from '@nestjs/common';
import { TokenLifecycleService } from '../services/token/token-lifecycle.service';

/**
 * Orchestrates access-token refresh.
 * Controller is responsible for extracting refreshToken (body or cookie fallback)
 * and deviceId from HTTP headers before calling here.
 */
@Injectable()
export class TokenRefreshUseCase {
  constructor(private readonly tokenLifecycle: TokenLifecycleService) {}

  refresh(refreshToken: string, deviceId: string | null) {
    return this.tokenLifecycle.refreshAccessToken(refreshToken, deviceId);
  }
}
