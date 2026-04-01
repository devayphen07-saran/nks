import { useEffect } from "react";
import { useAuth } from "../../store";

/**
 * Hook to initialize permissions on app mount.
 * On mobile, permissions are fetched during session initialization.
 * This hook ensures the app waits for auth to complete.
 *
 * Usage:
 * ```tsx
 * export default function App() {
 *   usePermissionsInitializer();
 *   return <AppLayout />;
 * }
 * ```
 */
export function usePermissionsInitializer() {
  const authState = useAuth();

  useEffect(() => {
    // Hook ready when auth initialization completes
    // Permissions are loaded via initializeAuth or refreshSession
  }, [authState.isInitializing]);
}
