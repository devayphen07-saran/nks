import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ✅ SECURITY: Make refreshToken optional since it can come from httpOnly cookie
// Mobile: Sends refreshToken in body
// Web: Sends refreshToken in httpOnly cookie (no body needed)
export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}
