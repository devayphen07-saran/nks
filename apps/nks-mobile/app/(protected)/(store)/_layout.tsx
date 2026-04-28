import { useEffect } from "react";
import { Redirect } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { useSegments } from "expo-router";
import { useSelector } from "react-redux";
import { setActiveStore } from "@nks/state-manager";
import { useRootDispatch, useAuthState } from "../../../store";
import type { RootState } from "../../../store";
import { StoreDrawerContent } from "@/features/store/StoreDrawerContent";
import { ROUTES } from "../../../lib/navigation/routes";

// Screens accessible without a store being selected
const STORE_FREE_SCREENS = ["list", "setup"];

export default function StoreLayout() {
  const dispatch = useRootDispatch();
  const authState = useAuthState();
  const activeStoreGuuid = useSelector((s: RootState) => s.store.activeStoreGuuid);
  const defaultStoreGuuid = authState.authResponse?.context?.defaultStoreGuuid ?? null;
  const segments = useSegments();

  // Seed Redux from the auth response on first entry so the gate passes
  // immediately when the user is routed here after login.
  useEffect(() => {
    if (!activeStoreGuuid && defaultStoreGuuid) {
      dispatch(setActiveStore({ guuid: defaultStoreGuuid, name: "" }));
    }
  }, [activeStoreGuuid, defaultStoreGuuid, dispatch]);

  // The effective store covers the brief moment before the effect runs
  const effectiveStore = activeStoreGuuid ?? defaultStoreGuuid;
  const currentScreen = segments[segments.length - 1] as string;

  if (!effectiveStore && !STORE_FREE_SCREENS.includes(currentScreen)) {
    return <Redirect href={ROUTES.STORE_LIST} />;
  }

  return (
    <Drawer
      drawerContent={(props) => <StoreDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStatusBarAnimation: "slide",
        drawerType: "slide",
      }}
    >
      <Drawer.Screen
        name="list"
        options={{
          drawerLabel: "My Stores",
          title: "My Stores",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="setup"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Setup Store",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="(tabs)"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Store",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="profile"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Store Profile",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="settings"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Settings",
          headerShown: false,
        }}
      />
    </Drawer>
  );
}
