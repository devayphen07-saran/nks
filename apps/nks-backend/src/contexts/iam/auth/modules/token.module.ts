import { Module } from '@nestjs/common';

import { TokenTheftDetectionService } from '../services/token/token-theft-detection.service';

/**
 * TokenModule — theft detection only.
 *
 * Token signing/verification, refresh-token primitives, token-pair issuance,
 * and lifecycle (rotation) live on TokenService / TokenLifecycleService inside
 * AuthModule because they depend on JWTConfigService, AuthUtilsService,
 * PermissionsService, and AuthUsersRepository — wiring those here would
 * create a cycle (AuthModule → TokenModule → AuthModule).
 */
@Module({
  providers: [TokenTheftDetectionService],
  exports: [TokenTheftDetectionService],
})
export class TokenModule {}
