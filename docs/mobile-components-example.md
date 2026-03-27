# Mobile Component Examples

Complete React Native/Expo components implementing the auth flow.

---

## 1. Login Screen Component

**File:** `apps/nks-mobile/src/screens/LoginScreen.tsx`

```typescript
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useBaseStoreDispatch, useBaseStoreSelector, type BaseStoreRootState } from "@nks/state-manager";
import { sendOtp, verifyOtp } from "@nks/api-manager";

export function LoginScreen({ navigation }: any) {
  const dispatch = useBaseStoreDispatch();
  const { sendOtpState, verifyOtpState } = useBaseStoreSelector(
    (state: BaseStoreRootState) => state.auth
  );

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [reqId, setReqId] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }

    try {
      const result = await dispatch(
        sendOtp({ bodyParam: { phone } })
      ).unwrap();
      setReqId(result.data.requestId);
      setStep("otp");
      Alert.alert("Success", "OTP sent to your phone");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to send OTP");
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert("Error", "Please enter a valid 6-digit OTP");
      return;
    }

    try {
      await dispatch(
        verifyOtp({ bodyParam: { phone, otp, reqId } })
      ).unwrap();

      // Navigate to ProfileCompletionScreen
      navigation.replace("ProfileCompletion");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to verify OTP");
    }
  };

  if (step === "phone") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Login with Phone</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter phone number"
          value={phone}
          onChangeText={setPhone}
          editable={!sendOtpState.isLoading}
          keyboardType="phone-pad"
          placeholderTextColor="#999"
        />

        <TouchableOpacity
          style={[styles.button, sendOtpState.isLoading && styles.buttonDisabled]}
          onPress={handleSendOtp}
          disabled={sendOtpState.isLoading}
        >
          {sendOtpState.isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send OTP</Text>
          )}
        </TouchableOpacity>

        {sendOtpState.hasError && (
          <Text style={styles.error}>Error sending OTP</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>We sent a code to {phone}</Text>

      <TextInput
        style={styles.input}
        placeholder="000000"
        value={otp}
        onChangeText={setOtp}
        editable={!verifyOtpState.isLoading}
        keyboardType="number-pad"
        maxLength={6}
        placeholderTextColor="#999"
      />

      <TouchableOpacity
        style={[styles.button, verifyOtpState.isLoading && styles.buttonDisabled]}
        onPress={handleVerifyOtp}
        disabled={verifyOtpState.isLoading}
      >
        {verifyOtpState.isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify OTP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setStep("phone")}>
        <Text style={styles.link}>Change phone number</Text>
      </TouchableOpacity>

      {verifyOtpState.hasError && (
        <Text style={styles.error}>Invalid OTP. Please try again.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  link: {
    color: "#007AFF",
    fontSize: 14,
    textAlign: "center",
  },
  error: {
    color: "#FF3B30",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
});
```

---

## 2. Profile Completion Screen Component

**File:** `apps/nks-mobile/src/screens/ProfileCompletionScreen.tsx`

```typescript
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useBaseStoreDispatch, useBaseStoreSelector, type BaseStoreRootState } from "@nks/state-manager";
import { profileComplete } from "@nks/api-manager";

export function ProfileCompletionScreen({ navigation }: any) {
  const dispatch = useBaseStoreDispatch();
  const { profileCompleteState } = useBaseStoreSelector(
    (state: BaseStoreRootState) => state.auth
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleComplete = async () => {
    if (!name || name.length < 2) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    if (email && password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }

    try {
      const result = await dispatch(
        profileComplete({
          bodyParam: {
            name,
            email: email || undefined,
            password: password || undefined,
          },
        })
      ).unwrap();

      if (result.data.nextStep === "verifyEmail") {
        // Navigate to email verification
        navigation.replace("EmailVerification", { email });
      } else if (result.data.nextStep === "complete") {
        // Go directly to store selection
        navigation.replace("StoreSelection");
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to complete profile");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Complete Your Profile</Text>

      <Text style={styles.label}>Full Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="John Doe"
        value={name}
        onChangeText={setName}
        editable={!profileCompleteState.isLoading}
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Email (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="john@example.com"
        value={email}
        onChangeText={setEmail}
        editable={!profileCompleteState.isLoading}
        keyboardType="email-address"
        placeholderTextColor="#999"
      />

      {email && (
        <>
          <Text style={styles.label}>Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Min 8 chars"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!profileCompleteState.isLoading}
            placeholderTextColor="#999"
          />
          <Text style={styles.hint}>
            • At least 8 characters
            {"\n"}• Mix of uppercase, lowercase, numbers, and special characters
          </Text>
        </>
      )}

      <TouchableOpacity
        style={[styles.button, profileCompleteState.isLoading && styles.buttonDisabled]}
        onPress={handleComplete}
        disabled={profileCompleteState.isLoading}
      >
        {profileCompleteState.isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>

      {profileCompleteState.hasError && (
        <Text style={styles.error}>Error completing profile</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 25,
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: "#666",
    marginBottom: 20,
    marginTop: -10,
    lineHeight: 18,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#FF3B30",
    fontSize: 14,
    textAlign: "center",
  },
});
```

---

## 3. Store Selection Screen Component

**File:** `apps/nks-mobile/src/screens/StoreSelectionScreen.tsx`

```typescript
import React, { useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useStores } from "@nks/api-handler";
import { useBaseStoreDispatch, useBaseStoreSelector, type BaseStoreRootState } from "@nks/state-manager";
import { storeSelect } from "@nks/api-manager";

export function StoreSelectionScreen({ navigation }: any) {
  const dispatch = useBaseStoreDispatch();
  const { storeSelectState } = useBaseStoreSelector(
    (state: BaseStoreRootState) => state.auth
  );

  const { data, isLoading, error } = useStores({ pageSize: 50 });
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  const stores = data?.items ?? [];

  const handleSelectStore = async (storeId: number) => {
    setSelectedStoreId(storeId);
    try {
      await dispatch(
        storeSelect({ bodyParam: { storeId } })
      ).unwrap();

      // Navigate to store dashboard
      navigation.replace("StoreDashboard");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to select store");
      setSelectedStoreId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading stores...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Error loading stores</Text>
        <Text style={styles.errorMessage}>Please try again</Text>
      </View>
    );
  }

  if (stores.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No stores available</Text>
        <Text style={styles.emptyMessage}>
          Contact admin to be assigned a store
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a Store</Text>

      <FlatList
        data={stores}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.storeCard,
              selectedStoreId === item.id && styles.storeCardSelected,
            ]}
            onPress={() => handleSelectStore(item.id)}
            disabled={selectedStoreId !== null && selectedStoreId !== item.id}
          >
            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{item.name}</Text>
              <Text style={styles.storeCity}>{item.city}</Text>
              {item.address && (
                <Text style={styles.storeAddress} numberOfLines={2}>
                  {item.address}
                </Text>
              )}
            </View>

            {selectedStoreId === item.id && storeSelectState.isLoading && (
              <ActivityIndicator color="#007AFF" />
            )}
          </TouchableOpacity>
        )}
        scrollEnabled={true}
      />

      {storeSelectState.hasError && (
        <Text style={styles.error}>Failed to select store. Try again.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    marginTop: 10,
  },
  storeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  storeCardSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#f0f8ff",
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  storeCity: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 12,
    color: "#999",
    lineHeight: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FF3B30",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#666",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: "#666",
  },
  error: {
    color: "#FF3B30",
    fontSize: 14,
    textAlign: "center",
    marginTop: 15,
    padding: 10,
    backgroundColor: "#FFE5E5",
    borderRadius: 8,
  },
});
```

---

## 4. Navigation Setup

**File:** `apps/nks-mobile/src/navigation/RootNavigator.tsx`

```typescript
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useBaseStoreSelector, type BaseStoreRootState } from "@nks/state-manager";

import { LoginScreen } from '../screens/LoginScreen';
import { ProfileCompletionScreen } from '../screens/ProfileCompletionScreen';
import { StoreSelectionScreen } from '../screens/StoreSelectionScreen';
import { StoreDashboardNavigator } from './StoreDashboardNavigator';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user, status } = useBaseStoreSelector(
    (state: BaseStoreRootState) => state.auth
  );

  // Determine which screen to show
  let initialRoute = "Login";

  if (status === "AUTHENTICATED" && user) {
    // Check if profile is complete
    const isProfileComplete = user.user.email && user.user.emailVerified;

    if (isProfileComplete && user.access.activeStoreId) {
      // User has selected a store
      initialRoute = "StoreDashboard";
    } else if (isProfileComplete) {
      // Profile complete, need to select store
      initialRoute = "StoreSelection";
    } else {
      // Need to complete profile
      initialRoute = "ProfileCompletion";
    }
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#fff' },
        }}
        initialRouteName={initialRoute}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            animationEnabled: false,
          }}
        />
        <Stack.Screen
          name="ProfileCompletion"
          component={ProfileCompletionScreen}
          options={{
            animationEnabled: false,
          }}
        />
        <Stack.Screen
          name="StoreSelection"
          component={StoreSelectionScreen}
          options={{
            animationEnabled: false,
          }}
        />
        <Stack.Screen
          name="StoreDashboard"
          component={StoreDashboardNavigator}
          options={{
            animationEnabled: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## 5. App Root Setup

**File:** `apps/nks-mobile/src/App.tsx`

```typescript
import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { baseStore, useBaseStoreDispatch } from '@nks/state-manager';
import { getSession } from '@nks/api-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootNavigator } from './navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});

function AppContent() {
  const dispatch = useBaseStoreDispatch();

  useEffect(() => {
    // Check if user has stored token on app launch
    const initializeAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          // Validate token with backend
          await dispatch(getSession({})).unwrap();
        }
      } catch (error) {
        console.log('Session expired or invalid');
        // User will see login screen
      }
    };

    initializeAuth();
  }, [dispatch]);

  return <RootNavigator />;
}

export default function App() {
  return (
    <Provider store={baseStore}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </Provider>
  );
}
```

---

## Token Persistence (AsyncStorage)

**File:** `apps/nks-mobile/src/utils/tokenStorage.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthResponse } from '@nks/api-manager';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const tokenStorage = {
  async saveAuth(authResponse: AuthResponse) {
    try {
      await AsyncStorage.multiSet([
        [TOKEN_KEY, authResponse.token],
        [USER_KEY, JSON.stringify(authResponse)],
      ]);
    } catch (error) {
      console.error('Failed to save auth:', error);
    }
  },

  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  },

  async getUser(): Promise<AuthResponse | null> {
    try {
      const user = await AsyncStorage.getItem(USER_KEY);
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  },

  async clearAuth() {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    } catch (error) {
      console.error('Failed to clear auth:', error);
    }
  },
};
```

---

## Key Features Implemented

✅ **OTP-based phone login** - Secure SMS verification
✅ **Profile completion** - Email + password after phone login
✅ **Store selection** - Choose which store to access
✅ **Loading states** - Activity indicators during API calls
✅ **Error handling** - User-friendly error messages
✅ **Token persistence** - AsyncStorage for app restarts
✅ **Navigation routing** - Automatic routing based on auth state
✅ **TypeScript** - Full type safety across components

