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
 * Unified API response envelope — identical shape for both success and error.
 *
 * Wire shape:
 * {
 *   status:     'success' | 'error',
 *   statusCode: number,
 *   message:    string,
 *   errorCode:  string | null,
 *   data:       T | null,
 *   errors:     Record<string, string[]> | null,
 *   details:    string[] | null,
 *   path:       string | null,
 *   timestamp:  string,
 *   requestId:  string | undefined,
 * }
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
   * Always present: status, statusCode, message, data, timestamp.
   * Present only when non-null: errorCode, errors, details, path, requestId.
   */
  toJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = {
      status: this.status,
      statusCode: this.statusCode,
      message: this.message,
      data: this.data,
      timestamp: this.timestamp,
    };
    if (this.meta !== null) out.meta = this.meta;
    if (this.errorCode !== null) out.errorCode = this.errorCode;
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
