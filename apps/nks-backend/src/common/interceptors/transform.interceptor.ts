import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { SKIP_TRANSFORM } from '../decorators/skip-transform.decorator';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { Readable } from 'stream';
import type { PaginatedResult } from '../utils/paginated-result';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  private readonly skipCache = new WeakMap<object, boolean>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const handler = context.getHandler();
    let skip = this.skipCache.get(handler);
    if (skip === undefined) {
      skip =
        this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM, [
          handler,
          context.getClass(),
        ]) ?? false;
      this.skipCache.set(handler, skip);
    }
    if (skip) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const rawRequestId = req.headers['x-request-id'];
    const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;

    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        handler,
        context.getClass(),
      ]) ?? 'Success';

    return next.handle().pipe(
      map((data) => {
        if (this.isBinaryResponse(data)) return data;

        const statusCode = res.statusCode;

        if (statusCode === 204) return undefined;

        if (data === undefined || data === null) {
          return new ApiResponse({ status: 'success', statusCode, message, data: null, requestId });
        }

        if (this.isPaginatedResult(data)) {
          const r = data as PaginatedResult<unknown>;
          return new ApiResponse({
            status: 'success',
            statusCode,
            message,
            data: r.data,
            meta: r.meta,
            requestId,
          });
        }

        return new ApiResponse({ status: 'success', statusCode, message, data, requestId });
      }),
    );
  }

  private isPaginatedResult(obj: unknown): obj is PaginatedResult<unknown> {
    if (typeof obj !== 'object' || obj === null) return false;
    return (obj as Record<string, unknown>)['__paginated'] === true;
  }

  private isBinaryResponse(data: unknown): boolean {
    return (
      data instanceof StreamableFile ||
      data instanceof Buffer ||
      data instanceof Uint8Array ||
      data instanceof ArrayBuffer ||
      data instanceof Readable ||
      (typeof Blob !== 'undefined' && data instanceof Blob) ||
      (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream)
    );
  }
}
