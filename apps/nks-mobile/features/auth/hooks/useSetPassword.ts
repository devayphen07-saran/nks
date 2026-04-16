import { useState } from "react";
import { router } from "expo-router";
import { passwordSchema } from "../schema/password";
import { profileComplete } from "@nks/api-manager";
import { useRootDispatch } from "../../../store";
import { ErrorHandler } from "../../../shared/errors";

export function useSetPassword() {
  const dispatch = useRootDispatch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    const result = passwordSchema.safeParse({ password, confirm });
    if (!result.success) {
      setErrorMessage(result.error.issues[0]?.message ?? "Invalid password");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    dispatch(profileComplete({ bodyParam: { password } }))
      .unwrap()
      .then(() => {
        router.replace("/(protected)/(workspace)");
      })
      .catch((err) => {
        const appError = ErrorHandler.handle(err, { action: "set_password" });
        setErrorMessage(appError.getUserMessage());
      })
      .finally(() => setIsLoading(false));
  };

  const handleSkip = () => {
    router.replace("/(protected)/(workspace)");
  };

  return {
    password,
    setPassword,
    showPassword,
    setShowPassword,
    confirm,
    setConfirm,
    showConfirm,
    setShowConfirm,
    isLoading,
    errorMessage,
    handleSubmit,
    handleSkip,
  };
}
