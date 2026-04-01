import React from "react";
import { Drawer } from "expo-router/drawer";
import { StoreDrawerContent } from "@/features/store/StoreDrawerContent";

export default function StoreLayout() {
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
        name="(dashboard)"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Dashboard",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="select"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Select Store",
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
        name="store"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Store Dashboard",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="products"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Products",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="orders"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Orders",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="staff"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Staff",
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

      <Drawer.Screen
        name="pos"
        options={{
          drawerItemStyle: { display: "none" },
          title: "POS",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="deliveries"
        options={{
          drawerItemStyle: { display: "none" },
          title: "Deliveries",
          headerShown: false,
        }}
      />
    </Drawer>
  );
}
