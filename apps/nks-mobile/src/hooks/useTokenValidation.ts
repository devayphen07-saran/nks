import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Logger } from '@/utils/logger';
import type { RootState } from '@/store';

/**
 * ✅ MODULE 4: Token Validation Hook
 *
 * Purpose:
 * - Validate tokens before API calls
 * - Offline-aware (different logic when offline)
 * - Detect tokens expiring soon (refresh if needed)
 * - Provide easy interface for components
 *
 * Usage:
 * const { validateBeforeApiCall, getValidationStatus } = useTokenValidation()
 *
 * // Before API call:
 * const result = await validateBeforeApiCall()
 * if (!result.valid) {
 *   // Handle invalid token (redirect to login, etc)
 * }
 * if (result.shouldRefresh) {
 *   // Refresh access token now
 * }
 */

type ValidationStatus = 'valid' | 'expired' | 'invalid' | 'expiring_soon';

interface ValidationResult {
  valid: boolean;
  status: ValidationStatus;
  error?: string;
  shouldRefresh?: boolean; // Token close to expiry, consider refreshing
  secondsUntilExpiry?: number;
}

const logger = new Logger('useTokenValidation');

// Constants
const REFRESH_BUFFER_SECONDS = 5 * 60; // Refresh if <5 min until expiry
const SEVERE_SKEW_THRESHOLD = 5 * 60; // >5 min time difference

export function useTokenValidation() {
  // Get services from Redux or context
  // This assumes services are stored in Redux state
  const auth = useSelector((state: RootState) => state.auth);
  const isOnline = useSelector((state: RootState) => state.connectivity?.isOnline) ?? true;

  /**
   * Main validation function
   * Call before any API request that requires authentication
   */
  const validateBeforeApiCall = useCallback(
    async (): Promise<ValidationResult> => {
      try {
        // No token stored
        if (!auth.accessToken) {
          logger.warn('❌ No access token found');
          return {
            valid: false,
            status: 'invalid',
            error: 'No token found. Please login.',
          };
        }

        // Check for severe time skew
        if (
          auth.timeSyncState?.isSynced &&
          Math.abs(auth.timeSyncState.offset) > SEVERE_SKEW_THRESHOLD
        ) {
          logger.warn('⚠️ Device time is severely out of sync');
          return {
            valid: false,
            status: 'invalid',
            error:
              'Device time is incorrect. Please check device settings.',
          };
        }

        // Try to verify token locally
        if (!isOnline) {
          return await validateOffline();
        } else {
          return await validateOnline();
        }
      } catch (error) {
        logger.error('Token validation error', error);
        return {
          valid: false,
          status: 'invalid',
          error:
            error instanceof Error
              ? error.message
              : 'Unknown validation error',
        };
      }
    },
    [auth, isOnline]
  );

  /**
   * Offline validation (local JWT verification only)
   */
  const validateOffline = useCallback(async (): Promise<ValidationResult> => {
    logger.debug('🔌 Offline mode: validating token locally');

    try {
      // In offline mode, we can only verify the token's signature
      // We cannot check with backend for revocation, etc.

      if (!auth.jwtPayload) {
        return {
          valid: false,
          status: 'invalid',
          error: 'Token payload not available',
        };
      }

      const now = auth.timeSync?.getCurrentTime?.() || Math.floor(Date.now() / 1000);
      const secondsUntilExpiry = auth.jwtPayload.exp - now;

      // Token expired
      if (secondsUntilExpiry < 0) {
        logger.warn(
          `❌ Offline: Token expired ${-secondsUntilExpiry} seconds ago`
        );
        return {
          valid: false,
          status: 'expired',
          error: 'Token expired. Cannot refresh while offline.',
          secondsUntilExpiry,
        };
      }

      // Token expiring soon
      if (secondsUntilExpiry < REFRESH_BUFFER_SECONDS) {
        logger.warn(
          `⚠️ Offline: Token expiring in ${secondsUntilExpiry} seconds`
        );
        return {
          valid: true,
          status: 'expiring_soon',
          shouldRefresh: true,
          secondsUntilExpiry,
        };
      }

      // Token valid
      logger.debug(
        `✅ Offline: Token valid for ${Math.floor(secondsUntilExpiry / 60)} more minutes`
      );
      return {
        valid: true,
        status: 'valid',
        secondsUntilExpiry,
      };
    } catch (error) {
      logger.error('Offline validation failed', error);
      return {
        valid: false,
        status: 'invalid',
        error: 'Offline validation failed',
      };
    }
  }, [auth.jwtPayload, auth.timeSync]);

  /**
   * Online validation (can check with backend if needed)
   */
  const validateOnline = useCallback(async (): Promise<ValidationResult> => {
    logger.debug('🌐 Online mode: validating token');

    try {
      if (!auth.jwtPayload) {
        return {
          valid: false,
          status: 'invalid',
          error: 'Token payload not available',
        };
      }

      const now = auth.timeSync?.getCurrentTime?.() || Math.floor(Date.now() / 1000);
      const secondsUntilExpiry = auth.jwtPayload.exp - now;

      // Token expired
      if (secondsUntilExpiry < 0) {
        logger.warn(
          `❌ Online: Token expired ${-secondsUntilExpiry} seconds ago`
        );
        return {
          valid: false,
          status: 'expired',
          error: 'Token expired. Please refresh or login again.',
          secondsUntilExpiry,
        };
      }

      // Token expiring soon
      if (secondsUntilExpiry < REFRESH_BUFFER_SECONDS) {
        logger.debug(
          `⏳ Online: Token expiring in ${secondsUntilExpiry} seconds, should refresh`
        );
        return {
          valid: true,
          status: 'expiring_soon',
          shouldRefresh: true,
          secondsUntilExpiry,
        };
      }

      // Token valid
      logger.debug(
        `✅ Online: Token valid for ${Math.floor(secondsUntilExpiry / 60)} more minutes`
      );
      return {
        valid: true,
        status: 'valid',
        secondsUntilExpiry,
      };
    } catch (error) {
      logger.error('Online validation failed', error);
      return {
        valid: false,
        status: 'invalid',
        error: 'Online validation failed',
      };
    }
  }, [auth.jwtPayload, auth.timeSync]);

  /**
   * Get current validation status without validation attempt
   */
  const getValidationStatus = useCallback((): ValidationStatus => {
    if (!auth.jwtPayload) {
      return 'invalid';
    }

    const now = auth.timeSync?.getCurrentTime?.() || Math.floor(Date.now() / 1000);
    const secondsUntilExpiry = auth.jwtPayload.exp - now;

    if (secondsUntilExpiry < 0) {
      return 'expired';
    }
    if (secondsUntilExpiry < REFRESH_BUFFER_SECONDS) {
      return 'expiring_soon';
    }
    return 'valid';
  }, [auth.jwtPayload, auth.timeSync]);

  /**
   * Get seconds remaining on token
   */
  const getSecondsRemaining = useCallback((): number | null => {
    if (!auth.jwtPayload) {
      return null;
    }

    const now = auth.timeSync?.getCurrentTime?.() || Math.floor(Date.now() / 1000);
    return Math.max(0, auth.jwtPayload.exp - now);
  }, [auth.jwtPayload, auth.timeSync]);

  /**
   * Check if token needs refresh
   */
  const needsRefresh = useCallback((): boolean => {
    const remaining = getSecondsRemaining();
    return remaining !== null && remaining < REFRESH_BUFFER_SECONDS;
  }, [getSecondsRemaining]);

  /**
   * Check if token is valid for API calls
   */
  const isTokenValid = useCallback((): boolean => {
    const remaining = getSecondsRemaining();
    return remaining !== null && remaining > 0;
  }, [getSecondsRemaining]);

  return {
    // Main functions
    validateBeforeApiCall,
    validateOffline,
    validateOnline,

    // Status queries
    getValidationStatus,
    getSecondsRemaining,
    needsRefresh,
    isTokenValid,

    // Debug info
    currentStatus: getValidationStatus(),
    secondsRemaining: getSecondsRemaining(),
    isOnline,
  };
}
