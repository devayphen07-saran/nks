import { Module } from '@nestjs/common';
import { RateLimitingGuard } from './rate-limiting.guard';

/**
 * RateLimitingModule — provides RateLimitingGuard as a standalone unit.
 *
 * Split out from GuardsModule so feature modules (AuthModule, …) that only
 * need rate limiting don't pull in AuthGuard's repository dependencies.
 * This also breaks the latent cycle that would otherwise appear if
 * GuardsModule ever needed to depend on AuthModule for query services
 * (see BACKEND_ARCHITECTURE.md § Service Decomposition Conventions).
 *
 * The guard's only runtime deps are the global `DATABASE_TOKEN` (via
 * `@InjectDb`) and `ConfigService`; no upstream imports needed.
 *
 * Usage:
 *   imports: [RateLimitingModule]
 *
 *   @UseGuards(RateLimitingGuard)
 *   @RateLimit(10)
 *   someSensitivePostEndpoint() { ... }
 */
@Module({
  providers: [RateLimitingGuard],
  exports: [RateLimitingGuard],
})
export class RateLimitingModule {}
