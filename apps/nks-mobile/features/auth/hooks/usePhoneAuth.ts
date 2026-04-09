import { useState } from "react";
import { router } from "expo-router";
import { phoneSchema } from "../schema/phone";
import { sendOtp } from "@nks/api-manager";
import { useRootDispatch } from "../../../store";

const DIAL_CODE = "91";

export function usePhoneAuth() {
  const dispatch = useRootDispatch();
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const canSubmit = phone.length === 10 && !isLoading;

  const handleSendOtp = () => {
    if (!canSubmit) return;

    const result = phoneSchema.safeParse({ phone: phone.trim() });
    if (!result.success) {
      setErrorMessage(
        result.error.issues[0]?.message ?? "Invalid phone number",
      );
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    const fullPhone = DIAL_CODE + phone.trim();

    dispatch(sendOtp({ bodyParam: { phone: fullPhone } }))
      .unwrap()
      .then((data) => {
        const reqId = data?.data?.reqId;
        if (reqId) {
          router.push({
            pathname: "/(auth)/otp",
            params: { phone: fullPhone, reqId },
          });
        } else {
          setErrorMessage("Failed to send OTP. Please try again.");
        }
      })
      .catch((err) => {
        const msg = err?.data?.message ?? err?.message ?? "Failed to send OTP";
        setErrorMessage(msg);
      })
      .finally(() => setIsLoading(false));
  };

  const handlePhoneChange = (text: string) => {
    setErrorMessage(null);
    setPhone(text.replace(/[^0-9]/g, "").slice(0, 10));
  };

  return {
    phone,
    setPhone: handlePhoneChange,
    dialCode: `+${DIAL_CODE}`,
    isFocused,
    setIsFocused,
    isLoading,
    canSubmit,
    errorMessage,
    handleSendOtp,
  };
}
