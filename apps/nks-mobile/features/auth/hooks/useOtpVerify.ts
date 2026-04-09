import { useState, useEffect, useRef, useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { otpSchema } from "../schema/otp";
import { verifyOtp, otpResend } from "@nks/api-manager";
import { useRootDispatch } from "../../../store";
import { persistLogin } from "../../../store/persistLogin";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export function useOtpVerify() {
  const dispatch = useRootDispatch();
  const { phone, reqId: initialReqId } = useLocalSearchParams<{
    phone: string;
    reqId: string;
  }>();

  const reqIdRef = useRef(initialReqId ?? "");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
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
    setCountdown(RESEND_COOLDOWN);
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

      dispatch(
        verifyOtp({
          bodyParam: { phone: phone ?? "", otp: otpValue, reqId: currentReqId },
        }),
      )
        .unwrap()
        .then(async (apiResponse) => {
          const authResponse = apiResponse?.data;

          if (authResponse?.data?.session?.sessionToken) {
            await persistLogin(authResponse, dispatch);
            router.replace(
              "/(protected)/(workspace)/(app)/(onboarding)/account-type",
            );
          } else {
            setErrorMessage("Verification failed. Please try again.");
          }
        })
        .catch((err) => {
          const msg =
            err?.data?.message ??
            err?.message ??
            "Verification failed. Please try again.";
          setErrorMessage(msg);
          setDigits(Array(OTP_LENGTH).fill(""));
        })
        .finally(() => setIsVerifying(false));
    },
    [isVerifying, phone, dispatch],
  );

  const handleDigitChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setErrorMessage(null);

    // Auto-verify when all digits filled
    if (newDigits.every((d) => d !== "")) {
      handleVerify(newDigits.join(""));
    }
  };

  const handleKeyPress = (
    e: { nativeEvent: { key: string } },
    index: number,
  ) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      setFocusedIndex(index - 1);
    }
  };

  const handleResend = useCallback(() => {
    if (isResending || countdown > 0) return;

    setIsResending(true);
    setErrorMessage(null);
    setDigits(Array(OTP_LENGTH).fill(""));

    dispatch(otpResend({ bodyParam: { reqId: reqIdRef.current } }))
      .unwrap()
      .then((data) => {
        const newReqId = data?.data?.reqId ?? reqIdRef.current;
        reqIdRef.current = newReqId;
        startCountdown();
      })
      .catch((err) => {
        const msg =
          err?.data?.message ??
          err?.message ??
          "Failed to resend OTP. Please try again.";
        setErrorMessage(msg);
      })
      .finally(() => setIsResending(false));
  }, [isResending, countdown, dispatch, startCountdown]);

  const canVerify = digits.every((d) => d !== "") && !isVerifying;

  return {
    digits,
    focusedIndex,
    countdown,
    errorMessage,
    canVerify,
    isVerifying,
    isResending,
    handleDigitChange,
    handleKeyPress,
    handleVerify,
    handleResend,
    setFocusedIndex,
    phone,
    OTP_LENGTH,
  };
}
