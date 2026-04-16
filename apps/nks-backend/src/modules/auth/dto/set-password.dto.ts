import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { passwordCreationSchema } from './password-validation.dto';

export const SetPasswordSchema = z.object({
  password: passwordCreationSchema,
});

export class SetPasswordDto extends createZodDto(SetPasswordSchema) {}
