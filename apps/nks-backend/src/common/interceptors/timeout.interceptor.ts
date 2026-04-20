import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { SERVER_CONSTANTS } from '../constants/app-constants';

/**
 * Enforces a global request timeout.
 *
 * If a request takes longer than the specified time (in ms),
 * it throws a RequestTimeoutException (408).
 *
 * Target: 30 seconds (matches REQUEST_TIMEOUT_MS in app-constants.ts)
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(SERVER_CONSTANTS.REQUEST_TIMEOUT_MS),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () => new RequestTimeoutException('Request Timeout'),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
