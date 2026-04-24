import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM = 'skipTransform';

/**
 * Prevents TransformInterceptor from wrapping the response in ApiResponse<T>.
 * Apply to endpoints that return non-JSON payloads (file downloads, streams,
 * binary data, SSE) where envelope wrapping would corrupt the response.
 *
 * @example
 * @SkipTransform()
 * @Get('export/csv')
 * exportCsv(@Res() res: Response) { ... }
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM, true);
