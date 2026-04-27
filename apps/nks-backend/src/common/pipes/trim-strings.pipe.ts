import { Injectable, PipeTransform } from '@nestjs/common';

/**
 * Globally trims leading/trailing whitespace from every string in the
 * incoming request body before Zod validation runs.
 *
 * Prevents storing values like "  John  " or "ACTIVE  " that pass
 * string validation but break equality checks and display in the UI.
 *
 * Sensitive fields (passwords, tokens, OTPs) are intentionally skipped —
 * a space in a password is meaningful and must never be silently removed.
 *
 * Registration order matters: this pipe must be registered BEFORE
 * ZodValidationPipe in AppModule so Zod sees the already-trimmed value.
 */
@Injectable()
export class TrimStringsPipe implements PipeTransform {
  private static readonly SKIP_KEYS = new Set([
    'password',
    'currentPassword',
    'newPassword',
    'confirmPassword',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'otp',
    'pin',
  ]);

  transform(value: unknown): unknown {
    return TrimStringsPipe.process(value, null);
  }

  static process(value: unknown, key: string | null): unknown {
    if (key !== null && TrimStringsPipe.SKIP_KEYS.has(key)) return value;
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) return value.map((item) => TrimStringsPipe.process(item, null));
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          TrimStringsPipe.process(v, k),
        ]),
      );
    }
    return value;
  }
}
