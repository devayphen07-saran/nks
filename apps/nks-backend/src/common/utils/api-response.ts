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
  path?: string | null;
  requestId?: string;
  /** Preserve an existing timestamp when rebuilding — defaults to now. */
  timestamp?: string;
}

/**
 * Unified API response envelope.
 *
 * Success wire shape (HTTP 2xx):
 * { message, data, timestamp, [meta], [requestId] }
 *
 * Error wire shape (HTTP 4xx/5xx):
 * { status: 'error', statusCode, message, errorCode, [errors], [details], [path], timestamp, [requestId] }
 *
 * Rules:
 *   - TransformInterceptor is the sole builder of success envelopes.
 *   - GlobalExceptionFilter is the sole builder of error envelopes.
 *   - Controllers return plain domain types + @ResponseMessage decorator;
 *     the interceptor wraps them here.
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
  readonly path: string | null;
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
    this.path = init.path ?? null;
    this.timestamp = init.timestamp ?? new Date().toISOString();
    this.requestId = init.requestId;
  }

  /**
   * Wire serialization — omits nullable fields when empty so the JSON payload
   * stays lean. Mirrors Spring's `@JsonInclude(NON_NULL)` / Go's `omitempty`.
   *
   * Success shape: { message, data, timestamp, [meta], [requestId] }
   * Error shape:   { status: 'error', statusCode, message, errorCode, [errors], [details], [path], timestamp, [requestId] }
   *
   * status/statusCode are omitted from success responses — HTTP status is the
   * authoritative source; duplicating it in the body is payload bloat.
   */
  toJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = {
      message: this.message,
      data: this.data,
      timestamp: this.timestamp,
    };
    if (this.status === 'error') {
      out.status = this.status;
      out.statusCode = this.statusCode;
      out.errorCode = this.errorCode;
    }
    if (this.meta !== null) out.meta = this.meta;
    if (this.errors !== null) out.errors = this.errors;
    if (this.details !== null) out.details = this.details;
    if (this.path !== null) out.path = this.path;
    if (this.requestId !== undefined) out.requestId = this.requestId;
    return out;
  }

  // ─── Error factories ──────────────────────────────────────────────────────

  static badRequest(
    errorCode: string,
    message: string,
    details?: string[] | null,
    requestId?: string,
  ): ApiResponse<null> {
    return new ApiResponse({
      status: 'error',
      statusCode: 400,
      message,
      errorCode,
      details,
      requestId,
    });
  }

  static notFound(
    errorCode: string,
    message: string,
    requestId?: string,
  ): ApiResponse<null> {
    return new ApiResponse({
      status: 'error',
      statusCode: 404,
      message,
      errorCode,
      requestId,
    });
  }

  static conflict(
    errorCode: string,
    message: string,
    requestId?: string,
  ): ApiResponse<null> {
    return new ApiResponse({
      status: 'error',
      statusCode: 409,
      message,
      errorCode,
      requestId,
    });
  }

  static unauthorized(
    errorCode: string,
    message: string,
    requestId?: string,
  ): ApiResponse<null> {
    return new ApiResponse({
      status: 'error',
      statusCode: 401,
      message,
      errorCode,
      requestId,
    });
  }

  static forbidden(
    errorCode: string,
    message: string,
    requestId?: string,
  ): ApiResponse<null> {
    return new ApiResponse({
      status: 'error',
      statusCode: 403,
      message,
      errorCode,
      requestId,
    });
  }

  static internalError(
    message = 'Internal server error',
    errorCode = 'GEN-ERR-005',
    requestId?: string,
  ): ApiResponse<null> {
    return new ApiResponse({
      status: 'error',
      statusCode: 500,
      message,
      errorCode,
      requestId,
    });
  }

  static error(
    statusCode: number,
    message: string,
    errorCode: string,
    details?: string[] | null,
    requestId?: string,
  ): ApiResponse<null> {
    return new ApiResponse({
      status: 'error',
      statusCode,
      message,
      errorCode,
      details,
      requestId,
    });
  }
}
