export function useAuth() {
  return {
    getCurrentUser: async () => null,
    getSessionsByUserId: async () => [],
    getActiveRoles: async () => [],
    getAllFlags: async () => [],
  };
}
