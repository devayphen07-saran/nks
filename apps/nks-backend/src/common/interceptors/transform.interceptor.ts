import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { DEPRECATED_KEY, type DeprecationMeta } from '../decorators/deprecated.decorator';
import { Readable } from 'stream';
import { PaginatedResult } from '../utils/paginated-result';

/**
 * Wraps every JSON handler response in the standard ApiResponse envelope.
 *
 * Contract:
 *   - Handlers that return domain objects get wrapped automatically.
 *   - Handlers that own their response format (streams, files, JWKS, SSE)
 *     must declare @RawResponse() — the interceptor passes them through unchanged.
 *   - 204 No Content responses are returned as-is (no body).
 *   - Non-HTTP contexts (WebSocket, gRPC) are never wrapped.
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TransformInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const handler = context.getHandler();
    const controllerClass = context.getClass();

    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [handler, controllerClass]) ?? false;
    if (raw) return next.handle();

    const message = this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [handler, controllerClass]) ?? 'Success';

    const deprecation = this.reflector.getAllAndOverride<DeprecationMeta | undefined>(DEPRECATED_KEY, [handler, controllerClass]);
    if (deprecation) {
      const res = context.switchToHttp().getResponse<Response>();
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', new Date(deprecation.sunset).toUTCString());
      if (deprecation.successor) {
        res.setHeader('Link', `<${deprecation.successor}>; rel="successor-version"`);
      }
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const rawRequestId = req.headers['x-request-id'];
    const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;

    return next.handle().pipe(
      map((data) => {
        const statusCode = res.statusCode;

        if (statusCode === 204) return undefined;

        if (this.looksLikeBinary(data)) {
          this.logger.warn(
            `Handler "${handler.name}" returned a binary value without @RawResponse(). Add the decorator to suppress this warning.`,
          );
          return data;
        }

        if (data === undefined || data === null) {
          return new ApiResponse({ status: 'success', statusCode, message, data: null, requestId });
        }

        if (data instanceof PaginatedResult) {
          return new ApiResponse({
            status: 'success',
            statusCode,
            message,
            data: data.data,
            meta: data.meta,
            requestId,
          });
        }

        return new ApiResponse({ status: 'success', statusCode, message, data, requestId });
      }),
    );
  }

  private looksLikeBinary(data: unknown): boolean {
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
