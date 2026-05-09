import { useEffect } from "react";
import { Drawer } from "expo-router/drawer";
import { useSelector } from "react-redux";
import { useRootDispatch, useAuthState } from "../../../store";
import type { RootState } from "../../../store";
import { StoreDrawerContent } from "@/features/store/StoreDrawerContent";
import { setActiveStoreByGuuid } from "../../../lib/store/active-store";

export default function StoreLayout() {
  const dispatch = useRootDispatch();
  const authState = useAuthState();
  const activeStoreGuuid = useSelector((s: RootState) => s.store.activeStoreGuuid);
  const defaultStoreGuuid = authState.authResponse?.context?.defaultStoreGuuid ?? null;

  // Seed Redux from the auth response on first entry. The helper looks up
  // the store name from local SQLite so the header chip renders a real label.
  // When the user has no default store, this effect is a no-op — the home
  // screen renders an empty state and prompts the user to pick or create one.
  useEffect(() => {
    if (activeStoreGuuid || !defaultStoreGuuid) return;
    setActiveStoreByGuuid(dispatch, defaultStoreGuuid);
  }, [activeStoreGuuid, defaultStoreGuuid, dispatch]);

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
