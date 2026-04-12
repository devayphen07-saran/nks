import React, { useCallback, useState } from "react";
import { SafeAreaView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import styled from "styled-components/native";
import {
  Avatar,
  Typography,
  LucideIcon,
  Row,
  Column,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useAuth } from "../../store";
import { useActiveStoreRole } from "./hooks/useActiveStoreRole";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import type { MenuItem } from "./constants/drawer-menu-config";

interface StoreDrawerContentProps extends DrawerContentComponentProps {}

export function StoreDrawerContent({ navigation }: StoreDrawerContentProps) {
  const router = useRouter();
  const { theme } = useMobileTheme();
  const [activeRoute, setActiveRoute] = useState("store");

  const authState = useAuth();
  const user = authState.authResponse?.user;
  const { activeStoreName, activeRole, menuItems, isOwner } = useActiveStoreRole();

  const userInitials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "U";

  // Use role-based menu items
  const mainMenuItems = menuItems;

  const handleNavigate = useCallback(
    (route: string) => {
      setActiveRoute(route);
      navigation.closeDrawer();
      navigation.navigate(route);
    },
    [navigation],
  );

  const handleSwitchToPersonal = useCallback(() => {
    navigation.closeDrawer();
    router.replace("/(protected)/(workspace)/(app)/(personal)/dashboard");
  }, [navigation, router]);

  const handleSwitchStores = useCallback(() => {
    navigation.closeDrawer();
    router.replace("/(protected)/(workspace)/(app)/(store)/list");
  }, [navigation, router]);

  const handleLogout = useCallback(() => {
    navigation.closeDrawer();
    // TODO: Integrate logout API call here
    router.replace("/(auth)/phone");
  }, [navigation, router]);

  const renderMenuItem = (item: MenuItem) => {
    const isActive = activeRoute === item.route;
    return (
      <MenuButton
        key={item.route}
        isActive={isActive}
        onPress={() => handleNavigate(item.route)}
        activeOpacity={0.7}
      >
        <Row align="center" gap="medium">
          <LucideIcon
            name={item.iconName as any}
            size={20}
            color={isActive ? theme.colorPrimary : theme.colorTextSecondary}
          />
          <Typography.Body
            weight={isActive ? "semiBold" : "medium"}
            color={isActive ? theme.colorPrimary : theme.colorText}
          >
            {item.label}
          </Typography.Body>
        </Row>
      </MenuButton>
    );
  };

  return (
    <DrawerContainer>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollContent
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: theme.sizing.large,
          }}
        >
          {/* User Profile Section */}
          <UserProfileSection>
            <Row align="center" gap="medium">
              <Avatar
                initials={userInitials}
                size={48}
                shape="square"
                showBorder
                borderColor={theme.colorPrimary}
                borderWidth={1.5}
              />

              <Column gap="xxSmall" style={{ flex: 1 }}>
                <Typography.H5
                  weight="bold"
                  color={theme.colorText}
                  numberOfLines={1}
                >
                  {user?.phoneNumber ?? "-"}
                </Typography.H5>
                <Typography.Caption
                  color={theme.colorTextSecondary}
                  numberOfLines={1}
                >
                  {user?.email ?? "Email not Linked"}
                </Typography.Caption>
              </Column>
            </Row>
          </UserProfileSection>

          <StyledDivider />

          {/* Active Store Context */}
          {activeStoreName && activeRole && (
            <StoreContextSection>
              <StoreContextHeader>
                <Typography.Caption color={theme.colorTextSecondary} weight="semiBold">
                  ACTIVE STORE
                </Typography.Caption>
              </StoreContextHeader>
              <Row gap="medium" align="center">
                <Column gap="xxSmall" style={{ flex: 1 }}>
                  <Typography.Body weight="semiBold" color={theme.colorText}>
                    {activeStoreName}
                  </Typography.Body>
                  <Row gap="small" align="center">
                    <RoleBadge>
                      <Typography.Caption color={theme.colorWhite} weight="semiBold">
                        {activeRole}
                      </Typography.Caption>
                    </RoleBadge>
                  </Row>
                </Column>
              </Row>
              <SwitchStoreButton onPress={handleSwitchStores}>
                <LucideIcon name="ArrowRightLeft" size={16} color={theme.colorTextSecondary} />
                <Typography.Caption color={theme.colorTextSecondary}>
                  Switch Store
                </Typography.Caption>
              </SwitchStoreButton>
            </StoreContextSection>
          )}

          <StyledDivider />

          {/* Context Toggle: Store / Personal */}
          <ContextToggleSection>
            <ContextToggleButton onPress={handleSwitchToPersonal}>
              <LucideIcon name="User" size={18} color={theme.colorTextSecondary} />
              <Typography.Body color={theme.colorTextSecondary}>Personal Account</Typography.Body>
            </ContextToggleButton>
          </ContextToggleSection>

          <StyledDivider />

          {/* Main Navigation */}
          <MenuSection>{mainMenuItems.map(renderMenuItem)}</MenuSection>
        </ScrollContent>

        {/* Logout Section */}
        <BottomSection>
          <LogoutButton onPress={handleLogout} activeOpacity={0.7}>
            <Row align="center" gap="medium">
              <LucideIcon name="LogOut" size={20} color={theme.colorError} />
              <Typography.Body weight="semiBold" color={theme.colorError}>
                Log out
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
`;

const UserProfileSection = styled.View`
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
  padding-top: ${({ theme }) => theme.sizing.xLarge}px;
  padding-bottom: ${({ theme }) => theme.sizing.medium}px;
`;

const StyledDivider = styled.View`
  height: 1px;
  background-color: ${({ theme }) => theme.colorBorderSecondary};
  margin-left: ${({ theme }) => theme.sizing.large}px;
  margin-right: ${({ theme }) => theme.sizing.large}px;
  margin-top: ${({ theme }) => theme.sizing.medium}px;
  margin-bottom: ${({ theme }) => theme.sizing.medium}px;
  opacity: 10;
`;

const MenuSection = styled.View`
  padding-left: ${({ theme }) => theme.sizing.medium}px;
  padding-right: ${({ theme }) => theme.sizing.medium}px;
  margin-bottom: ${({ theme }) => theme.sizing.small}px;
`;

const MenuButton = styled.TouchableOpacity<{ isActive: boolean }>`
  padding-top: ${({ theme }) => theme.sizing.medium}px;
  padding-bottom: ${({ theme }) => theme.sizing.medium}px;
  padding-left: ${({ theme }) => theme.sizing.medium}px;
  padding-right: ${({ theme }) => theme.sizing.medium}px;
  background-color: ${({ theme, isActive }) =>
    isActive ? theme.colorBgLayout : "transparent"};
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
  margin-bottom: 2px;
`;

const BottomSection = styled.View`
  border-top-width: 1px;
  border-top-color: ${({ theme }) => theme.colorBorderSecondary};
  padding: ${({ theme }) => theme.sizing.large}px;
`;

const LogoutButton = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
`;

const StoreContextSection = styled.View`
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
  padding-top: ${({ theme }) => theme.sizing.medium}px;
  padding-bottom: ${({ theme }) => theme.sizing.medium}px;
`;

const StoreContextHeader = styled.View`
  margin-bottom: ${({ theme }) => theme.sizing.small}px;
`;

const RoleBadge = styled.View`
  background-color: ${({ theme }) => theme.colorPrimary};
  border-radius: 12px;
  padding-left: 8px;
  padding-right: 8px;
  padding-top: 4px;
  padding-bottom: 4px;
`;

const SwitchStoreButton = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.sizing.small}px;
  margin-top: ${({ theme }) => theme.sizing.small}px;
  padding: ${({ theme }) => theme.sizing.small}px ${({ theme }) => theme.sizing.medium}px;
`;

const ContextToggleSection = styled.View`
  padding-left: ${({ theme }) => theme.sizing.medium}px;
  padding-right: ${({ theme }) => theme.sizing.medium}px;
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
`;

const ContextToggleButton = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.sizing.small}px;
  padding: ${({ theme }) => theme.sizing.medium}px;
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
`;
