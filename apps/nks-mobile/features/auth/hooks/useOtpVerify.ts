import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { otpSchema } from "../schema/otp";
import { verifyOtp, otpResend } from "@nks/api-manager";
import { useRootDispatch } from "../../../store";
import { persistLogin } from "../../../store/persist-login";
import { ErrorHandler } from "../../../shared/errors";
import { OTP_RATE_LIMITS } from "../../../lib/rate-limiter";
import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from "@nks/utils";
import { ROUTES } from "../../../lib/routes";

export function useOtpVerify() {
  const dispatch = useRootDispatch();
  const { phone: rawPhone, reqId: initialReqId } = useLocalSearchParams<{
    phone: string;
    reqId: string;
  }>();

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
    return clearTimer;
  }, [startCountdown, clearTimer]);

  const handleVerify = useCallback(
    (otpValue: string) => {
      if (isVerifying) return;

      // ✅ CRITICAL FIX #5: Rate limit OTP verification attempts
      const rateLimitCheck = OTP_RATE_LIMITS.verify.check();
      if (!rateLimitCheck.allowed) {
        setErrorMessage(
          rateLimitCheck.message || "Too many attempts. Please wait.",
        );
        setDigits(Array(OTP_LENGTH).fill(""));
        return;
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
            await persistLogin(authResponse, dispatch);
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

    // ✅ CRITICAL FIX #5: Rate limit OTP resend attempts
    const rateLimitCheck = OTP_RATE_LIMITS.resend.check();
    if (!rateLimitCheck.allowed) {
      setErrorMessage(
        rateLimitCheck.message || "Please wait before requesting another OTP.",
      );
      return;
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
    resetOtp,
    phone,
    OTP_LENGTH,
  };
}
