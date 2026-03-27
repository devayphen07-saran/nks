import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../utils/api-response';

/**
 * Automatically wraps every controller return value in `ApiResponse<T>`.
 *
 * Controllers that already return `ApiResponse.ok(...)` are passed through
 * unchanged. Raw return values (plain objects, arrays, primitives) are wrapped.
 *
 * All raw arrays are wrapped as { items: [...] } according to the standard shape.
 *
 * Register globally in main.ts:
 *   app.useGlobalInterceptors(new TransformInterceptor());
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Already wrapped — pass through as-is
        if (data instanceof ApiResponse)
          return data as unknown as ApiResponse<T>;

        // Handle raw arrays — wrap as { items: [...] }
        if (Array.isArray(data)) {
          return ApiResponse.ok({ items: data }) as unknown as ApiResponse<T>;
        }

        // Handle raw single items
        return ApiResponse.ok(data);
      }),
    );
  }
}
