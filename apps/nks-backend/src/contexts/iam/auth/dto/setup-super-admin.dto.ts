import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { passwordCreationSchema } from './password-validation.dto';

export const SetupSuperAdminSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: passwordCreationSchema,
});

export class SetupSuperAdminDto extends createZodDto(SetupSuperAdminSchema) {}
