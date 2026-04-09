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
      user: {
        create: {
          after: async (user) => {
            try {
              const userId = Number(user.id);
              if (isNaN(userId)) return;

              // Check if any SUPER_ADMIN exists in user_role_mapping
              const [existingSuperAdmin] = await db
                .select({ id: userRoleMapping.id })
                .from(userRoleMapping)
                .innerJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
                .where(
                  and(
                    eq(schema.roles.code, 'SUPER_ADMIN'),
                    isNull(userRoleMapping.storeFk),
                    isNull(userRoleMapping.deletedAt),
                    eq(userRoleMapping.isActive, true),
                  ),
                )
                .limit(1);

              if (!existingSuperAdmin) {
                // Assign SUPER_ADMIN role to first user
                const [superAdminRole] = await db
                  .select({ id: schema.roles.id })
                  .from(schema.roles)
                  .where(and(eq(schema.roles.code, 'SUPER_ADMIN'), isNull(schema.roles.storeFk)))
                  .limit(1);

                if (superAdminRole) {
                  await db.insert(userRoleMapping).values({
                    userFk: userId,
                    roleFk: superAdminRole.id,
                    isPrimary: true,
                    isActive: true,
                    assignedAt: new Date(),
                  });
                  Logger.log(
                    `First user (ID: ${userId}) assigned SUPER_ADMIN`,
                    'Auth',
                  );
                }
              }
            } catch (err) {
              Logger.error(
                'Failed to auto-assign SUPER_ADMIN role',
                err,
                'Auth',
              );
            }
          },
        },
      },
    },
  });
};

export type Auth = ReturnType<typeof getAuth>;
