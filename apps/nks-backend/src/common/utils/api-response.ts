/**
 * Standard API response wrapper for NestJS.
 *
 * All responses follow the shape:
 * {
 *   status:  'success' | 'error' | 'warning',
 *   message: string,
 *   data:    T | { items: T[] } | null,
 *   meta?:   { page: number; limit: number; total: number; totalPages: number } | null,
 *   code?:   string | null,   // for errors
 * }
 */
export class ApiResponse<T> {
  status: 'success' | 'error' | 'warning';
  message: string;
  data: T | null;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  code?: string | null;

  private constructor(
    status: 'success' | 'error' | 'warning',
    message: string,
    data: T | null = null,
    meta?: ApiResponse<T>['meta'],
    code?: string | null,
  ) {
    this.status = status;
    this.message = message;
    this.data = data;
    this.meta = meta;
    this.code = code;
  }

  /**
   * Return a successful response.
   */
  static ok<T>(data: T, message = 'Success'): ApiResponse<T> {
    return new ApiResponse('success', message, data);
  }

  /**
   * Return a paginated successful response.
   * Standardizes the list shape as { items: [] } within the data field.
   */
  static paginated<T>(
    items: T[],
    page: number,
    limit: number,
    total: number,
    message = 'Success',
  ): ApiResponse<{ items: T[] }> {
    const totalPages = Math.ceil(total / limit);
    return new ApiResponse(
      'success',
      message,
      { items },
      { page, limit, total, totalPages },
    );
  }

  /**
   * Return an error response.
   */
  static error(
    message: string,
    code = 'INTERNAL_SERVER_ERROR',
  ): ApiResponse<null> {
    return new ApiResponse('error', message, null, null, code);
  }
}
