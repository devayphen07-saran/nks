import { Module } from '@nestjs/common';

// Repositories
import { JtiBlocklistRepository } from '../repositories/jti-blocklist.repository';

// Services
import { TokenTheftDetectionService } from '../services/token/token-theft-detection.service';
import { JtiBlocklistService } from '../services/token/jti-blocklist.service';

// Security
import { RefreshTokenService } from '../services/session/refresh-token.service';

/**
 * TokenModule — pure token infrastructure: JTI blocklist, theft detection, refresh tokens.
 *
 * Services that need cross-cutting auth providers (JWTConfigService, AuthUtilsService,
 * PermissionsService, AuthUsersRepository) live in AuthModule to avoid a circular
 * dependency (AuthModule → TokenModule, TokenModule ↛ AuthModule).
 *
 * Moved to AuthModule: TokenService, TokenLifecycleService, TokenPairGeneratorService.
 */
@Module({
  providers: [
    JtiBlocklistRepository,
    TokenTheftDetectionService,
    JtiBlocklistService,
    RefreshTokenService,
  ],
  exports: [
    JtiBlocklistRepository,
    TokenTheftDetectionService,
    JtiBlocklistService,
    RefreshTokenService,
  ],
})
export class TokenModule {}
