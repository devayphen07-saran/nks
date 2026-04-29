import { Module } from '@nestjs/common';

// Repositories
import { JtiBlocklistRepository } from '../repositories/jti-blocklist.repository';

// Services
import { TokenService } from '../services/token/token.service';
import { TokenPairGeneratorService } from '../services/token/token-pair-generator.service';
import { TokenLifecycleService } from '../services/token/token-lifecycle.service';
import { TokenTheftDetectionService } from '../services/token/token-theft-detection.service';
import { JtiBlocklistService } from '../services/token/jti-blocklist.service';

// Security
import { RefreshTokenService } from '../services/session/refresh-token.service';

/**
 * TokenModule — encapsulates token lifecycle, rotation, and JTI blocklist management.
 *
 * Responsibilities:
 *   - Token pair generation (access + refresh)
 *   - Token rotation and lifecycle
 *   - Theft detection and validation
 *   - JTI (JWT ID) blocklist management
 */
@Module({
  providers: [
    // Repositories
    JtiBlocklistRepository,

    // Core token services
    TokenService,
    TokenPairGeneratorService,
    TokenLifecycleService,
    TokenTheftDetectionService,
    JtiBlocklistService,
    RefreshTokenService,
  ],
  exports: [
    TokenService,
    TokenPairGeneratorService,
    TokenLifecycleService,
    TokenTheftDetectionService,
    JtiBlocklistService,
    RefreshTokenService,
  ],
})
export class TokenModule {}