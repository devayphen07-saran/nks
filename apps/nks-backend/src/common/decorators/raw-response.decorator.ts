import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'rawResponse';

/**
 * Declares that the handler owns its response format completely.
 * TransformInterceptor will pass the return value through unchanged.
 *
 * Use for: file downloads, streams, SSE, JWKS endpoints, and any handler
 * that sets its own Content-Type or serializes data outside the standard
 * JSON envelope.
 *
 * @example
 * @RawResponse()
 * @Get('export/csv')
 * exportCsv(@Res({ passthrough: true }) res: Response) { ... }
 *
 * @example
 * @RawResponse()
 * @Get('.well-known/jwks.json')
 * getJwks(): JwkSet { ... }
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
