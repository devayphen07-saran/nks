/**
 * Mobile App Initialization
 *
 * Call this in your root app component (e.g., App.tsx)
 * Initializes offline-first sync, auth, and connectivity monitoring
 */

import { useEffect } from 'react';
import SyncService from './lib/sync-service';
import SecureSessionStorage from './lib/secure-storage';

/**
 * Initialize all auth and sync services
 * Call this in your root component's useEffect
 *
 * Example:
 * ```tsx
 * function App() {
 *   useEffect(() => {
 *     initializeApp();
 *   }, []);
 *   // ... rest of component
 * }
 * ```
 */
export async function initializeApp() {
  try {
    console.log('🚀 Initializing NKS mobile app...');

    // ✅ Step 1: Check if user is logged in
    const isLoggedIn = await SecureSessionStorage.isLoggedIn();
    console.log(`📱 User logged in: ${isLoggedIn}`);

    // ✅ Step 2: Setup connectivity monitoring
    // Auto-syncs when device comes online
    const unsubscribeNetInfo = SyncService.watchConnectivity();

    // ✅ Step 3: Try to sync pending requests
    if (isLoggedIn) {
      console.log('📤 Checking for pending requests...');
      const queue = await SyncService.getQueue();
      if (queue.length > 0) {
        console.log(`Found ${queue.length} pending requests. Syncing...`);
        await SyncService.syncQueue();
      }
    }

    // ✅ Step 4: Setup app resume handler
    // If user resumes app and was offline, try to sync
    if (isLoggedIn) {
      setupAppResumeSync();
    }

    console.log('✅ App initialized successfully');

    // Return cleanup function
    return () => {
      unsubscribeNetInfo?.();
    };
  } catch (error) {
    console.error('❌ App initialization failed:', error);
  }
}

/**
 * Setup app resume sync
 * Triggers sync when user brings app to foreground
 */
function setupAppResumeSync() {
  // For React Native Expo
  if (typeof window === 'undefined') {
    // This is React Native
    try {
      const { AppState } = require('react-native');
      let appState = AppState.currentState;

      const subscription = AppState.addEventListener('change', handleAppStateChange);

      function handleAppStateChange(nextAppState: string) {
        if (appState.match(/inactive|background/) && nextAppState === 'active') {
          console.log('📱 App resumed. Checking for pending sync...');
          SyncService.forceSyncIfNeeded();
        }
        appState = nextAppState;
      }

      return () => subscription.remove();
    } catch (error) {
      console.warn('⚠️ Could not setup app resume sync:', error);
    }
  }
}

/**
 * Utility: Get debug information about auth state
 */
export async function getAuthDebugInfo() {
  try {
    const isLoggedIn = await SecureSessionStorage.isLoggedIn();
    const ttl = await SecureSessionStorage.getTokenTTL();
    const isExpired = await SecureSessionStorage.isTokenExpired();
    const user = await SecureSessionStorage.getUserData();
    const syncStats = await SyncService.getStats();

    return {
      isLoggedIn,
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
      token: {
        ttl: `${ttl}s`,
        isExpired,
      },
      sync: syncStats,
    };
  } catch (error) {
    return { error: String(error) };
  }
}

/**
 * Usage in React Navigation setup:
 *
 * ```tsx
 * import { NavigationContainer } from '@react-navigation/native';
 * import { useAuth } from './hooks/useAuth';
 * import { initializeApp } from './app.setup';
 *
 * export default function App() {
 *   const { isLoggedIn, loading } = useAuth();
 *
 *   useEffect(() => {
 *     initializeApp();
 *   }, []);
 *
 *   if (loading) {
 *     return <SplashScreen />;
 *   }
 *
 *   return (
 *     <NavigationContainer>
 *       {isLoggedIn ? <AppStack /> : <AuthStack />}
 *     </NavigationContainer>
 *   );
 * }
 * ```
 */

export default initializeApp;
