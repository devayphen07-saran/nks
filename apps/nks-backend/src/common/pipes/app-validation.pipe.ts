import { Injectable } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { TrimStringsPipe } from './trim-strings.pipe';

/**
 * Single global validation pipe: trims whitespace then validates via Zod.
 *
 * Replaces the two-pipe sequence (TrimStringsPipe → ZodValidationPipe) that
 * was previously registered as separate APP_PIPE entries. Trim runs first so
 * Zod sees clean values; sensitive fields (passwords, tokens, OTPs) are
 * skipped by the trim step as before.
 */
@Injectable()
export class AppValidationPipe extends ZodValidationPipe {
  override transform(value: unknown, metadata: ArgumentMetadata): unknown {
    return super.transform(TrimStringsPipe.process(value, null), metadata);
  }
}
