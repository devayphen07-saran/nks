import { useState } from "react";
import { router } from "expo-router";
import { passwordSchema, type PasswordFields } from "../schema/password";

export function useSetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (isLoading) return;

    const result = passwordSchema.safeParse({ password, confirm });
    if (!result.success) {
      const firstError = result.error.issues[0];
      setErrorMessage(firstError?.message ?? "Invalid password");
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      // Note: Password is set via PROFILE_COMPLETE endpoint (to be wired when available)
      // For now, navigate to workspace — password will be collected in profile completion flow
      router.replace("/(protected)/(workspace)");
    } catch (error) {
      setErrorMessage("Failed to set password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace("/(protected)/(workspace)");
  };

  return {
    // password state
    password,
    setPassword,
    showPassword,
    setShowPassword,

    // confirm state
    confirm,
    setConfirm,
    showConfirm,
    setShowConfirm,

    // request state
    isLoading,
    errorMessage,

    // actions
    handleSubmit,
    handleSkip,
  };
}
