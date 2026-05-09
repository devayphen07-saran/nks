import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, jwt, admin } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import * as schema from '../../../../core/database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AUTH_CONSTANTS } from '../../../../common/constants/app-constants';

export type BetterAuthConfig = {
  baseUrl: string;
  secret: string;
  googleClientId?: string;
  googleClientSecret?: string;
};

export const getAuth = (
  db: NodePgDatabase<typeof schema>,
  config: BetterAuthConfig,
) => {
  return betterAuth({
    useNumberId: true,
    baseURL: config.baseUrl,
    secret: config.secret,
    advanced: {
      database: { generateId: false },
    },

    plugins: [
      expo(),
      bearer(),
      jwt({
        jwt: {
          issuer: config.baseUrl,
          audience: config.baseUrl,
          expirationTime: '15m',
          definePayload: ({ user, session }) => {
            const u = user as typeof user & { role?: string };
            const s = session as typeof session & { activeStoreFk?: number | null };
            return {
              sub: user.id,
              email: user.email,
              role: u.role ?? 'user',
              storeId: s.activeStoreFk,
              sessionId: session.id,
            };
          },
        },
        jwks: {
          keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' },
          rotationInterval: 60 * 60 * 24 * 90,
          gracePeriod: 60 * 60 * 24 * 30,
        },
      }),
      admin({ defaultRole: 'user' }),
    ],

    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.userSession,
        account: schema.userAuthProvider,
      },
    }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },

    socialProviders: {
      ...(config.googleClientId && config.googleClientSecret
        ? {
            google: {
              clientId: config.googleClientId,
              clientSecret: config.googleClientSecret,
            },
          }
        : {}),
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
      // Session tokens are stored plaintext in user_session.token. Refresh
      // tokens are hashed (refreshTokenHash). The asymmetry is deliberate —
      // session-token lookup is on the hot path of every authenticated
      // request and benefits from a direct index hit; refresh tokens are
      // only checked on rotation. If you want session tokens hashed at
      // rest (DB-dump protection), that requires a custom adapter that
      // hashes on write AND lookup — not a flag.
      additionalFields: {
        // Device tracking fields
        deviceId: { type: 'string', required: false },
        deviceName: { type: 'string', required: false },
        deviceType: { type: 'string', required: false },
        appVersion: { type: 'string', required: false },

        activeStoreFk: { type: 'number', required: false },
        userRoles: { type: 'string', required: false }, // JSON array of roles
        primaryRole: { type: 'string', required: false }, // Primary role code

        // csrfSecret must be declared so BetterAuth inserts '' (NOT NULL constraint).
        // SessionBootstrapService.updateByToken overwrites it with the real random
        // secret immediately after session creation. The empty-string placeholder
        // is live during the window between createSession() and updateByToken() —
        // any request arriving in that window fails CSRF rather than silently
        // passing.
        csrfSecret: { type: 'string', required: false, defaultValue: '' },

      },
      expiresIn: AUTH_CONSTANTS.SESSION.EXPIRY_SECONDS, // 30 days — must match AUTH_CONSTANTS.SESSION.EXPIRY_SECONDS
      updateAge: AUTH_CONSTANTS.SESSION.UPDATE_AGE_SECONDS, // refresh if older than 1 day
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

  });
};

export type Auth = ReturnType<typeof getAuth>;
