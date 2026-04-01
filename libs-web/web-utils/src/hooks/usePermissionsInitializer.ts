import { useEffect } from 'react';
import { useBaseStoreDispatch, useBaseStoreSelector, type BaseStoreRootState } from '@nks/state-manager';
import { fetchUserRoutes } from '@nks/api-manager';
import { getAccessToken } from '../auth-storage';

/**
 * Hook to initialize permissions on app mount.
 * Fetches permissions once and prevents re-fetching on page refresh.
 *
 * Usage:
 * ```tsx
 * function App() {
 *   usePermissionsInitializer();
 *   return <Routes />;
 * }
 * ```
 */
export function usePermissionsInitializer() {
  const dispatch = useBaseStoreDispatch();
  const routesState = useBaseStoreSelector(
    (state: BaseStoreRootState) => state.routes
  );
  const isInitialized = useBaseStoreSelector(
    (state: BaseStoreRootState) => state.auth.status !== 'INITIALIZING'
  );

  useEffect(() => {
    if (!isInitialized) return;

    const token = getAccessToken();
    if (!token) return;

    if (routesState.permissionsLoaded) return;
    if (routesState.fetchState.isLoading) return;

    dispatch(fetchUserRoutes({}));
  }, [isInitialized, dispatch, routesState.permissionsLoaded, routesState.fetchState.isLoading]);
}
