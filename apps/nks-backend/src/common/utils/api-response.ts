export interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasMore: boolean;
}

export interface ApiResponseInit<T> {
  status: 'success' | 'error';
  statusCode: number;
  message: string;
  data?: T | null;
  meta?: PaginationMeta | null;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
  details?: string[] | null;
  requestId?: string;
  /** Preserve an existing timestamp when rebuilding — defaults to now. */
  timestamp?: string;
}

/**
 * Unified API response envelope.
 *
 * Unified wire shape (success and error):
 * { message, data, [errorCode], [errors], [details], [pagination], meta: { timestamp, [requestId] } }
 *
 * HTTP status code is the sole signal for success vs error — body fields
 * status/statusCode are not emitted (redundant with the transport layer).
 *
 * Rules:
 *   - TransformInterceptor is the sole builder of success envelopes.
 *   - GlobalExceptionFilter is the sole builder of error envelopes.
 *   - Controllers return plain domain types + @ResponseMessage decorator;
 *     the interceptor wraps them here.
 *   - `pagination` (formerly `meta`) carries page/total info for list endpoints.
 *   - `meta` always carries request-level metadata (timestamp, requestId).
 */
export class ApiResponse<T = unknown> {
  readonly status: 'success' | 'error';
  readonly statusCode: number;
  readonly message: string;
  readonly errorCode: string | null;
  readonly data: T | null;
  readonly meta: PaginationMeta | null;
  readonly errors: Record<string, string[]> | null;
  readonly details: string[] | null;
  readonly timestamp: string;
  readonly requestId: string | undefined;

  constructor(init: ApiResponseInit<T>) {
    if (init.statusCode < 100 || init.statusCode > 599) {
      throw new RangeError(`Invalid HTTP status code: ${init.statusCode}`);
    }
    this.status = init.status;
    this.statusCode = init.statusCode;
    this.message = init.message;
    this.data = init.data ?? null;
    this.meta = init.meta ?? null;
    this.errorCode = init.errorCode ?? null;
    this.errors = init.errors ?? null;
    this.details = init.details ?? null;
    this.timestamp = init.timestamp ?? new Date().toISOString();
    this.requestId = init.requestId;
  }

  /**
   * Wire serialization — omits nullable fields when empty so the JSON payload
   * stays lean. Mirrors Spring's `@JsonInclude(NON_NULL)` / Go's `omitempty`.
   *
   * status/statusCode are never emitted — HTTP status is the authoritative
   * signal. errorCode identifies the error type for non-2xx responses.
   * `pagination` carries page/total info (renamed from `meta` to free the key).
   * `meta` always carries request-level metadata (timestamp, requestId).
   */
  toJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = {
      message: this.message,
      data: this.data,
    };
    if (this.status === 'error') {
      out.errorCode = this.errorCode;
    }
    if (this.meta !== null) out.pagination = this.meta;
    if (this.errors !== null) out.errors = this.errors;
    if (this.details !== null) out.details = this.details;
    const metaBlock: Record<string, unknown> = { timestamp: this.timestamp };
    if (this.requestId !== undefined) metaBlock.requestId = this.requestId;
    out.meta = metaBlock;
    return out;
  }

}
