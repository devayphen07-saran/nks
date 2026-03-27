import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const PublicUserSchema = z.object({
  id: z.string().describe('User ID'),
  name: z.string().nullable().describe('User name'),
  email: z.string().nullable().describe('User email'),
  emailVerified: z.boolean().describe('Is email verified'),
  phoneNumber: z.string().nullable().describe('User phone number'),
  phoneNumberVerified: z.boolean().describe('Is phone verified'),
  image: z.string().nullable().describe('User profile image'),
  lastLoginAt: z.string().nullable().describe('Last login timestamp'),
  lastLoginIp: z.string().nullable().describe('Last login IP address'),
});

const SessionMetadataSchema = z.object({
  sessionId: z.string().describe('Unique session ID'),
  tokenType: z.string().default('Bearer').describe('Token type'),
  accessToken: z.string().describe('JWT access token'),
  issuedAt: z.string().describe('Token issued timestamp'),
  expiresAt: z.string().describe('Token expiration timestamp'),
  refreshToken: z.string().describe('Refresh token for renewing access'),
  refreshExpiresAt: z.string().describe('Refresh token expiration'),
  mechanism: z
    .enum(['password', 'otp', 'oauth', 'token'])
    .describe('Authentication mechanism used'),
  absoluteExpiry: z.string().describe('Absolute session expiry'),
});

const AuthContextSchema = z.object({
  method: z
    .enum(['password', 'otp', 'oauth'])
    .describe('Authentication method'),
  mfaVerified: z.boolean().describe('Is MFA verified'),
  mfaRequired: z.boolean().describe('Is MFA required'),
  trustLevel: z
    .enum(['standard', 'high', 'unverified'])
    .describe('Device/session trust level'),
  stepUpRequired: z.boolean().describe('Does step-up authentication required'),
});

const UserRoleEntrySchema = z.object({
  roleCode: z.enum([
    'SUPER_ADMIN',
    'STORE_OWNER',
    'STAFF',
    'STORE_MANAGER',
    'CASHIER',
    'DELIVERY',
    'CUSTOMER',
  ]).describe('Role code'),
  storeId: z.number().nullable().describe('Store ID if applicable'),
  storeName: z.string().nullable().describe('Store name'),
  isPrimary: z.boolean().describe('Is this the primary role'),
  assignedAt: z.string().describe('When role was assigned'),
  expiresAt: z.string().nullable().describe('Role expiration date'),
});

const AccessControlSchema = z.object({
  isSuperAdmin: z
    .boolean()
    .describe('Whether the user has absolute administrative privileges'),
  activeStoreId: z
    .number()
    .nullable()
    .describe('Currently active store ID'),
  roles: z
    .array(UserRoleEntrySchema)
    .describe('All roles assigned to user'),
  initialRoute: z
    .string()
    .describe('Initial route to redirect user to after login'),
});

const FeatureFlagsSchema = z.record(z.string(), z.boolean());

export class AccessControlDto extends (createZodDto as any)(AccessControlSchema) {}
export class AuthContextDto extends (createZodDto as any)(AuthContextSchema) {}

export const AuthDataSchema = z.object({
  user: PublicUserSchema,
  session: SessionMetadataSchema,
  authContext: AuthContextSchema,
  access: AccessControlSchema,
  flags: FeatureFlagsSchema,
});

export const ApiMetadataSchema = z.object({
  requestId: z.string().describe('Unique request identifier'),
  traceId: z.string().describe('Trace ID for distributed tracing'),
  apiVersion: z.string().describe('API version'),
  status: z.enum(['success', 'error', 'partial']).describe('Response status'),
  timestamp: z.string().describe('Response timestamp'),
});

export const AuthResponseSchema = ApiMetadataSchema.extend({
  data: AuthDataSchema,
});

export class AuthResponseDto extends (createZodDto as any)(AuthResponseSchema) {}
