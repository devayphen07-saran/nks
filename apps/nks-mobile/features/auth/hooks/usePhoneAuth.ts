import { useState, useCallback, useRef } from "react";
import { router } from "expo-router";
import { phoneSchema } from "../schema/phone";
import { sendOtp } from "@nks/api-manager";
import { useRootDispatch } from "../../../store";
import { handleError } from "../../../shared/errors";
import { OTP_RATE_LIMITS } from '../../../lib/utils/rate-limiter';
import {
  formatPhoneWithCountryCode,
  sanitizePhoneInput,
  INDIA_DIAL_CODE,
} from "@nks/utils";
import { setPendingOtpSession } from "../lib/otp-session";

export function usePhoneAuth() {
  const dispatch = useRootDispatch();
  const [phone, setPhoneState] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Ref-based guard prevents double-submit from rapid taps
  const submittingRef = useRef(false);

  const canSubmit = phone.length === 10 && !isLoading;

  const handlePhoneChange = useCallback((text: string) => {
    const sanitized = sanitizePhoneInput(text);
    setPhoneState(sanitized);
    setErrorMessage(null);
  }, []);

  const handleSendOtp = useCallback(() => {
    if (!canSubmit || submittingRef.current) return;

    // Rate limit OTP send attempts (persisted across app restarts)
    // Skip in dev so repeated test runs are not blocked
    if (!__DEV__) {
      const rateLimitCheck = OTP_RATE_LIMITS.send.check();
      if (!rateLimitCheck.allowed) {
        setErrorMessage(rateLimitCheck.message || "Please wait before requesting another OTP.");
        return;
      }
      OTP_RATE_LIMITS.send.recordAttempt();
    }

    // Validate phone format
    const validationResult = phoneSchema.safeParse({ phone: phone.trim() });
    if (!validationResult.success) {
      setErrorMessage(
        validationResult.error.issues[0]?.message ?? "Invalid phone number",
      );
      return;
    }

    submittingRef.current = true;
    setErrorMessage(null);
    setIsLoading(true);

    const fullPhone = formatPhoneWithCountryCode(phone);

    dispatch(sendOtp({ bodyParam: { phone: fullPhone } }))
      .unwrap()
      .then((response) => {
        const reqId = response?.data?.reqId;
        if (reqId) {
          setPendingOtpSession(fullPhone, reqId);
          router.push({ pathname: "/(auth)/otp" });
        } else {
          setErrorMessage("Invalid response from server");
        }
      })
      .catch((error) => {
        const appError = handleError(error, {
          phone: phone,
          action: "send_otp",
        });
        setErrorMessage(appError.getUserMessage());
      })
      .finally(() => {
        setIsLoading(false);
        submittingRef.current = false;
      });
  }, [phone, canSubmit, dispatch]);

  return {
    phone,
    dialCode: INDIA_DIAL_CODE,
    isFocused,
    isLoading,
    errorMessage,
    setPhone: handlePhoneChange,
    setIsFocused,
    handleSendOtp,
    canSubmit,
  };
}
