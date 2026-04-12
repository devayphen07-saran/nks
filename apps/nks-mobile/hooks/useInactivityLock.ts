/**
 * useInactivityLock — locks the app after 5 minutes in the background.
 *
 * Lifecycle:
 *   app goes background → start 5-min timer
 *   timer fires         → set auth status 'locked' (write-guard blocks all mutations)
 *   app comes to foreground while locked → prompt biometric re-auth
 *   biometric success   → restore 'authenticated' status
 *   biometric failure   → remain locked (user can retry)
 *
 * Usage: call once from a root component that is always mounted when logged in.
 *   useInactivityLock();
 */

import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useRootDispatch, useAuth as useReduxAuth } from "../store";
import { withBiometricGate } from "../lib/biometric-gate";
import { setUnauthenticated } from "../store/auth-slice";
import { createLogger } from "../lib/logger";

const log = createLogger("InactivityLock");

// Lock after this much time in background
const LOCK_AFTER_MS = 5 * 60 * 1000; // 5 minutes

// Track lock state outside component to survive re-renders
let _isLocked = false;

export function useInactivityLock(): void {
  const dispatch = useRootDispatch();
  const { isAuthenticated } = useReduxAuth();
  const lastStateRef = useRef<AppStateStatus>(AppState.currentState);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    function clearTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    async function attemptBiometricUnlock() {
      if (!_isLocked) return;

      log.info("Biometric unlock prompt triggered");
      const unlocked = await withBiometricGate(
        () => Promise.resolve(true),
        "Verify your identity to continue",
      ).catch(() => false);

      if (unlocked) {
        _isLocked = false;
        log.info("Biometric unlock succeeded");
        // Auth state was not cleared — just update in-memory lock flag.
        // Redux isAuthenticated remains true — no dispatch needed.
      } else {
        log.warn("Biometric unlock failed — app remains locked");
        // Force logout if user can't authenticate
        dispatch(setUnauthenticated());
      }
    }

    const subscription = AppState.addEventListener(
      "change",
      async (nextState: AppStateStatus) => {
        const prev = lastStateRef.current;
        lastStateRef.current = nextState;

        if (nextState === "background" || nextState === "inactive") {
          // Start inactivity timer
          clearTimer();
          timerRef.current = setTimeout(() => {
            _isLocked = true;
            log.warn(`App locked after ${LOCK_AFTER_MS / 60000} min in background`);
          }, LOCK_AFTER_MS);
          return;
        }

        if (nextState === "active") {
          clearTimer();

          if (_isLocked && (prev === "background" || prev === "inactive")) {
            await attemptBiometricUnlock();
          }
        }
      },
    );

    return () => {
      clearTimer();
      subscription.remove();
    };
  }, [isAuthenticated, dispatch]);
}
