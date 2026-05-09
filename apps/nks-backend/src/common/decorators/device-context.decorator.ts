import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Validated device context lifted from request headers.
 *
 * Headers are user-controlled; reading them straight via `@Headers()` lets
 * malformed values flow into business logic (e.g. `x-device-type: undefined`).
 * This decorator normalises and bounds them once, in one place.
 *
 * Field rules:
 *   - `deviceId`     — opaque token; max 128 chars, alphanumeric + `-`/`_`/`:`.
 *                      Anything else is dropped to `null`.
 *   - `deviceType`   — uppercased, restricted to a closed set; otherwise `null`.
 *   - `sessionId`    — opaque session identifier; max 128 chars, otherwise `null`.
 *
 * The decorator never throws — invalid headers degrade to `null` so existing
 * controllers can keep their `?? null` fallbacks. Callers that need strict
 * validation should layer Zod on top.
 */
export interface DeviceContext {
  deviceId: string | null;
  deviceType: 'IOS' | 'ANDROID' | 'WEB' | null;
  sessionId: string | null;
}

const MAX_DEVICE_FIELD_LENGTH = 128;
const DEVICE_ID_RE = /^[A-Za-z0-9_:.-]+$/;
const ALLOWED_DEVICE_TYPES = new Set(['IOS', 'ANDROID', 'WEB']);

function readSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function safeOpaque(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_DEVICE_FIELD_LENGTH) return null;
  if (!DEVICE_ID_RE.test(trimmed)) return null;
  return trimmed;
}

function safeDeviceType(raw: unknown): DeviceContext['deviceType'] {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return ALLOWED_DEVICE_TYPES.has(upper) ? (upper as DeviceContext['deviceType']) : null;
}

export const DeviceContextHeaders = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DeviceContext => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const h = req.headers;
    return {
      deviceId: safeOpaque(readSingle(h['x-device-id'])),
      deviceType: safeDeviceType(readSingle(h['x-device-type'])),
      sessionId: safeOpaque(readSingle(h['x-session-id'])),
    };
  },
);
