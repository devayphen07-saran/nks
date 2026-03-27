import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';

/**
 * Generic Zod validation pipe for cases where `nestjs-zod` is not used.
 *
 * @example
 * @Get()
 * list(@Query(new ZodValidationPipe(QuerySchema)) query: QueryDto) { ... }
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: err.flatten().fieldErrors,
        });
      }
      throw err;
    }
  }
}
