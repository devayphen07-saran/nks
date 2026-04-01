import React, { useCallback } from "react";
import { TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import styled from "styled-components/native";
import {
  Avatar,
  Typography,
  LucideIcon,
  Row,
  Column,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { RootState, useRootDispatch, useUserProfile } from "../../store";
import { logoutThunk } from "../../store/logoutThunk";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { router } from "expo-router";

interface MenuCategory {
  title: string;
  items: {
    label: string;
    route: string;
    iconName: string;
  }[];
}

export function PersonalDrawerContent(props: DrawerContentComponentProps) {
  const { navigation } = props;
  const dispatch = useRootDispatch();
  const { theme } = useMobileTheme();

  const {
    getUserDetail: { response: user },
  } = useUserProfile();

  const menuCategories: MenuCategory[] = [
    {
      title: "Personal",
      items: [
        {
          label: "Dashboard",
          route: "/(protected)/(workspace)/(app)/(personal)/dashboard",
          iconName: "LayoutDashboard",
        },
        {
          label: "Expenses",
          route: "/(protected)/(workspace)/(app)/(personal)/dashboard", // Placeholder for expenses
          iconName: "Wallet",
        },
      ],
    },
    {
      title: "Workspace",
      items: [
        {
          label: "Switch to Store",
          route: "/(protected)/(workspace)/(app)/(store)/list",
          iconName: "Store",
        },
      ],
    },
  ];

  const handleLogout = useCallback(() => {
    navigation.closeDrawer();
    dispatch(logoutThunk());
  }, [dispatch, navigation]);

  const handleNavigate = useCallback(
    (route: string) => {
      navigation.closeDrawer();
      router.push(route as any);
    },
    [navigation],
  );

  const userInitials =
    user?.name
      ?.split(" ")
      .map((name: string) => name[0])
      .join("")
      .toUpperCase() ?? "U";

  return (
    <DrawerContainer>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollContent showsVerticalScrollIndicator={false}>
          {/* User Profile Header */}
          <ProfileHeader>
            <Row align="center" gap="medium">
              <Avatar initials={userInitials} size={56} shape="circle" />
              <Column gap="xxSmall" style={{ flex: 1 }}>
                <Typography.H5 weight="bold" numberOfLines={1}>
                  {user?.name ?? "User"}
                </Typography.H5>
                <Typography.Caption type="secondary" numberOfLines={1}>
                  {user?.phoneNumber ?? "Personal Account"}
                </Typography.Caption>
              </Column>
            </Row>
          </ProfileHeader>

          {/* Menu Sections */}
          {menuCategories.map((category) => (
            <CategorySection key={category.title}>
              <SectionTitle>
                <Typography.Caption
                  weight="semiBold"
                  color={theme.colorTextSecondary}
                >
                  {category.title}
                </Typography.Caption>
              </SectionTitle>
              {category.items.map((item) => (
                <MenuItemButton
                  key={item.label}
                  onPress={() => handleNavigate(item.route)}
                  activeOpacity={0.6}
                >
                  <Row align="center" gap="medium">
                    <LucideIcon
                      name={item.iconName as any}
                      size={20}
                      color={theme.colorTextSecondary}
                    />
                    <Typography.Body weight="medium">
                      {item.label}
                    </Typography.Body>
                  </Row>
                </MenuItemButton>
              ))}
            </CategorySection>
          ))}
        </ScrollContent>

        {/* Bottom Section - Logout */}
        <BottomSection>
          <LogoutButton onPress={handleLogout} activeOpacity={0.7}>
            <Row align="center" justify="center" gap="small">
              <LucideIcon
                name="LogOut"
                size={20}
                color={theme.colorWhite || "#FFFFFF"}
              />
              <Typography.Body weight="bold" color={theme.colorWhite || "#FFFFFF"}>
                Log Out
              </Typography.Body>
            </Row>
          </LogoutButton>
        </BottomSection>
      </SafeAreaView>
    </DrawerContainer>
  );
}

const DrawerContainer = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgContainer};
`;

const ScrollContent = styled.ScrollView`
  flex: 1;
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
  padding-top: ${({ theme }) => theme.sizing.large}px;
`;

const ProfileHeader = styled.View`
  padding-top: ${({ theme }) => theme.sizing.large}px;
  padding-bottom: ${({ theme }) => theme.sizing.large}px;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const CategorySection = styled.View`
  padding-top: ${({ theme }) => theme.sizing.medium}px;
  padding-bottom: ${({ theme }) => theme.sizing.medium}px;
`;

const SectionTitle = styled.View`
  margin-bottom: ${({ theme }) => theme.sizing.small}px;
  margin-top: ${({ theme }) => theme.sizing.small}px;
`;

const MenuItemButton = styled.TouchableOpacity`
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
`;

const BottomSection = styled.View`
  border-top-width: 1px;
  border-top-color: ${({ theme }) => theme.colorBorderSecondary};
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
  padding-top: ${({ theme }) => theme.sizing.large}px;
  padding-bottom: ${({ theme }) => theme.sizing.large}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
`;

const LogoutButton = styled.TouchableOpacity`
  background-color: ${({ theme }) => theme.colorError};
  padding-top: ${({ theme }) => theme.sizing.medium}px;
  padding-bottom: ${({ theme }) => theme.sizing.medium}px;
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
  align-items: center;
  justify-content: center;
`;
