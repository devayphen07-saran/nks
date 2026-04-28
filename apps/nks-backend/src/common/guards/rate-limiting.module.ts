import { Module } from '@nestjs/common';
import { RateLimitingGuard } from './rate-limiting.guard';
import { RateLimitService } from './services/rate-limit.service';

/**
 * RateLimitingModule — provides RateLimitingGuard as a standalone unit.
 *
 * Split out from GuardsModule so feature modules (AuthModule, …) that only
 * need rate limiting don't pull in AuthGuard's repository dependencies.
 *
 * RateLimitingGuard is a thin decision-maker; RateLimitService owns the
 * database-backed sliding window counter and cleanup.
 *
 * Both resolve @InjectDb from the global DatabaseModule — no explicit
 * DatabaseModule import needed here.
 */
@Module({
  providers: [RateLimitingGuard, RateLimitService],
  exports: [RateLimitingGuard, RateLimitService],
})
export class RateLimitingModule {}
