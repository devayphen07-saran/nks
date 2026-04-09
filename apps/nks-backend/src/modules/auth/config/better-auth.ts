import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import * as schema from '../../../core/database/schema';
import { userRoleMapping } from '../../../core/database/schema/auth/user-role-mapping';
import { eq, and, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Logger } from '@nestjs/common';

export const getAuth = (db: NodePgDatabase<typeof schema>) => {
  return betterAuth({
    useNumberId: true,
    baseURL: process.env.BETTER_AUTH_BASE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    advanced: {
      database: { generateId: false },
    },

    // Bearer token plugin for mobile Bearer auth
    plugins: [bearer()],

    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.userSession,
        account: schema.userAuthProvider,
        verification: schema.otpVerification,
      },
    }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },

    user: {
      additionalFields: {
        guuid: { type: 'string', required: false },
        phoneNumber: { type: 'string', required: false },
        phoneNumberVerified: { type: 'boolean', defaultValue: false },
        kycLevel: { type: 'number', defaultValue: 0 },
        languagePreference: { type: 'string', defaultValue: 'en' },
        whatsappOptedIn: { type: 'boolean', defaultValue: true },
        isBlocked: { type: 'boolean', defaultValue: false },
        blockedReason: { type: 'string', required: false },
        loginCount: { type: 'number', defaultValue: 0 },
      },
    },

    session: {
      hashSessionToken: true,
      additionalFields: {
        // Device tracking fields
        deviceId: { type: 'string', required: false },
        deviceName: { type: 'string', required: false },
        deviceType: { type: 'string', required: false },
        appVersion: { type: 'string', required: false },

        activeStoreFk: { type: 'number', required: false },
        userRoles: { type: 'string', required: false }, // JSON array of roles
        primaryRole: { type: 'string', required: false }, // Primary role code

        // Note: roleHash and jwtToken are handled separately in auth.service.ts
        // They are not defined here to avoid Better Auth insertion conflicts
        // Instead, they are UPDATEd after session creation
      },
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh if older than 1 day
    },

    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60 * 15, max: 5 }, // 5 attempts per 15 min
        '/sign-up/email': { window: 60 * 10, max: 10 }, // 10 signups per 10 min
      },
    },

    databaseHooks: {
      // NOTE: SUPER_ADMIN assignment logic has been moved to AuthService.assignFirstUserAsSuperAdminIfNeeded()
      // This ensures business logic is in the service layer, not in config.
      // The hook is intentionally kept minimal - actual role assignment is handled by AuthService.
      user: {
        create: {
          after: async (user) => {
            // SECURITY NOTE: This hook is called automatically by BetterAuth after user creation.
            // However, the actual SUPER_ADMIN role assignment is handled by AuthService.assignFirstUserAsSuperAdminIfNeeded()
            // which is called explicitly in the register() and other user creation flows.
            // This separation ensures: (1) business logic in service layer, (2) testability, (3) auditability
          },
        },
      },
    },
  });
};

export type Auth = ReturnType<typeof getAuth>;
