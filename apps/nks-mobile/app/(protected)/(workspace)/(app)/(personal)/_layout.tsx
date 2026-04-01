import React from "react";
import { Drawer } from "expo-router/drawer";
import { PersonalDrawerContent } from "@/features/personal/PersonalDrawerContent";

export default function PersonalLayout() {
  return (
    <Drawer
      drawerContent={(props) => <PersonalDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStatusBarAnimation: "slide",
        drawerType: "slide",
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          drawerItemStyle: { display: "none" },
        }}
      />
    </Drawer>
  );
}
