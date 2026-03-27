import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

/**
 * Parses and validates a route/query parameter as a positive integer ID.
 *
 * Throws a typed 400 if the value is missing, not numeric, or ≤ 0.
 *
 * @example
 * @Get(':id')
 * getById(@Param('id', ParseIdPipe) id: number) { ... }
 */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const parsed = Number(value);

    if (!value || !Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(
        `${metadata.data ?? 'id'} must be a positive integer, received: ${value}`,
      );
    }

    return parsed;
  }
}
