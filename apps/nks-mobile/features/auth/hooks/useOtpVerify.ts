import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { router } from "expo-router";
import { otpSchema } from "../schema/otp";
import { verifyOtp, otpResend } from "@nks/api-manager";
import { useRootDispatch } from "../../../store";
import { persistLogin } from "../../../store/persist-login";
import { ErrorHandler } from "../../../shared/errors";
import { OTP_RATE_LIMITS } from '../../../lib/utils/rate-limiter';
import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from "@nks/utils";
import { ROUTES } from '../../../lib/navigation/routes';
import { JWTManager } from '../../../lib/auth/jwt-manager';
import { registerProactiveRefresh } from '../../../lib/auth/jwt-refresh';
import { getPendingOtpSession, clearPendingOtpSession } from "../lib/otp-session";

export function useOtpVerify() {
  const dispatch = useRootDispatch();
  const { phone: rawPhone, reqId: initialReqId } = getPendingOtpSession();

  // Clean up phone: remove duplicate +, ensure single prefix
  const phone = rawPhone ? rawPhone.replace(/^\++/, "+") : "";

  const reqIdRef = useRef(initialReqId ?? "");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(OTP_RESEND_COOLDOWN_SECONDS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    clearTimer();
    setCountdown(OTP_RESEND_COOLDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  useEffect(() => {
    startCountdown();
    return () => {
      clearTimer();
      clearPendingOtpSession();
    };
  }, [startCountdown, clearTimer]);

  const handleVerify = useCallback(
    (otpValue: string) => {
      if (isVerifying) return;

      // Rate limit OTP verification attempts (persisted across app restarts)
      // Skip in dev so repeated test runs are not blocked
      if (!__DEV__) {
        const rateLimitCheck = OTP_RATE_LIMITS.verify.check();
        if (!rateLimitCheck.allowed) {
          setErrorMessage(
            rateLimitCheck.message || "Too many attempts. Please wait.",
          );
          setDigits(Array(OTP_LENGTH).fill(""));
          return;
        }
        OTP_RATE_LIMITS.verify.recordAttempt();
      }

      const currentReqId = reqIdRef.current;
      if (!currentReqId) {
        setErrorMessage("Session expired. Please request a new OTP.");
        return;
      }

      const result = otpSchema.safeParse({ otp: otpValue });
      if (!result.success) {
        setErrorMessage(result.error.issues[0]?.message ?? "Invalid OTP");
        return;
      }

      setErrorMessage(null);
      setIsVerifying(true);

      const payload = {
        phone: phone ?? "",
        otp: otpValue,
        reqId: currentReqId,
      };

      dispatch(verifyOtp({ bodyParam: payload }))
        .unwrap()
        .then(async (apiResponse) => {
          const authResponse = apiResponse?.data;

          if (authResponse?.session?.sessionToken) {
            // Reset rate limiter on successful verification
            OTP_RATE_LIMITS.verify.reset();
            clearPendingOtpSession();
            await persistLogin(authResponse, dispatch);

            // Cache NKS RS256 JWKS for offline JWT verification (non-critical)
            const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
            const serverBase = apiUrl.replace(/\/api\/v\d+\/?$/, "");
            JWTManager.cacheJWKS(serverBase).catch(() => {});

            // Register proactive access token refresh on app foreground
            registerProactiveRefresh();

            router.replace(ROUTES.ACCOUNT_TYPE);
          } else {
            setErrorMessage("Verification failed. Please try again.");
          }
        })
        .catch((err) => {
          const appError = ErrorHandler.handle(err, {
            phone: phone,
            otp: "***",
            action: "verify_otp",
          });
          setErrorMessage(appError.getUserMessage());
          setDigits(Array(OTP_LENGTH).fill(""));
        })
        .finally(() => setIsVerifying(false));
    },
    [isVerifying, phone, dispatch],
  );

  /**
   * Update all digits at once from the hidden input's accumulated text.
   * Avoids the stale-closure bug of updating one digit at a time.
   */
  const setOtpFromString = useCallback(
    (text: string) => {
      const cleaned = text.replace(/[^0-9]/g, "").slice(0, OTP_LENGTH);
      const newDigits = Array.from(
        { length: OTP_LENGTH },
        (_, i) => cleaned[i] || "",
      );
      setDigits(newDigits);
      setErrorMessage(null);

      // Auto-verify when all 6 digits entered
      if (cleaned.length === OTP_LENGTH) {
        handleVerify(cleaned);
      }
    },
    [handleVerify],
  );

  const resetOtp = useCallback(() => {
    setDigits(Array(OTP_LENGTH).fill(""));
    setErrorMessage(null);
  }, []);

  const handleResend = useCallback(() => {
    if (isResending || countdown > 0) return;

    // Rate limit OTP resend attempts (persisted across app restarts)
    // Skip in dev so repeated test runs are not blocked
    if (!__DEV__) {
      const rateLimitCheck = OTP_RATE_LIMITS.resend.check();
      if (!rateLimitCheck.allowed) {
        setErrorMessage(
          rateLimitCheck.message || "Please wait before requesting another OTP.",
        );
        return;
      }
      OTP_RATE_LIMITS.resend.recordAttempt();
    }

    setIsResending(true);
    resetOtp();

    dispatch(otpResend({ bodyParam: { reqId: reqIdRef.current } }))
      .unwrap()
      .then((data) => {
        const newReqId = data?.data?.reqId ?? reqIdRef.current;
        reqIdRef.current = newReqId;
        OTP_RATE_LIMITS.resend.reset();
        startCountdown();
      })
      .catch((err) => {
        const appError = ErrorHandler.handle(err, {
          phone: phone,
          action: "resend_otp",
          reqId: reqIdRef.current,
        });
        setErrorMessage(appError.getUserMessage());
      })
      .finally(() => setIsResending(false));
  }, [isResending, countdown, dispatch, startCountdown, resetOtp, phone]);

  const canVerify = useMemo(
    () => digits.every((d) => d !== "") && !isVerifying,
    [digits, isVerifying],
  );

  return {
    digits,
    countdown,
    errorMessage,
    canVerify,
    isVerifying,
    isResending,
    setOtpFromString,
    handleVerify,
    handleResend,
    phone,
    OTP_LENGTH,
  };
}
