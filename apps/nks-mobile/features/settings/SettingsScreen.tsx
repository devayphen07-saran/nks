import React, { useEffect } from "react";
import { ScrollView, TouchableOpacity, Alert, View } from "react-native";
import styled from "styled-components/native";
import {
  Typography,
  Column,
  Row,
  LucideIcon,
  Header,
  Switch,
  SegmentedTabs,
  Divider,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useRootDispatch, useUserPreferences } from "../../store";
import {
  getUserPreferences,
  updateUserPreferences,
  updateTheme,
} from "@nks/api-manager";
import { router } from "expo-router";
import { ThemeEnum } from "@nks/shared-types";

export function SettingsScreen() {
  const { theme } = useMobileTheme();
  const dispatch = useRootDispatch();
  const {
    getPreferences,
    updatePreferences,
    updateTheme: updateThemeState,
  } = useUserPreferences();

  useEffect(() => {
    dispatch(getUserPreferences());
  }, [dispatch]);

  const preferences = getPreferences.response;

  const handleThemeChange = async (newTheme: string) => {
    try {
      const resultAction = await dispatch(
        updateTheme({ bodyParam: { theme: newTheme as any } }),
      );
      if (!updateTheme.fulfilled.match(resultAction)) {
        const error = resultAction.payload as any;
        Alert.alert(
          "Error",
          error?.message || "Failed to update theme preference",
        );
      }
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred");
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    try {
      const resultAction = await dispatch(
        updateUserPreferences({ bodyParam: { notificationsEnabled: enabled } }),
      );
      if (!updateUserPreferences.fulfilled.match(resultAction)) {
        const error = resultAction.payload as any;
        Alert.alert(
          "Error",
          error?.message || "Failed to update notification settings",
        );
      }
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred");
    }
  };

  const themeItems = [
    {
      key: ThemeEnum.LIGHT,
      label: "Light",
      iconElement: <LucideIcon name="Sun" size={16} color={theme.colorText} />,
    },
    {
      key: ThemeEnum.DARK,
      label: "Dark",
      iconElement: <LucideIcon name="Moon" size={16} color={theme.colorText} />,
    },
    {
      key: ThemeEnum.AUTO,
      label: "System",
      iconElement: (
        <LucideIcon name="Monitor" size={16} color={theme.colorText} />
      ),
    },
  ];

  return (
    <Container>
      <Header
        title="App Settings"
        leftElement={
          <TouchableOpacity onPress={() => router.back()}>
            <LucideIcon name="ChevronLeft" size={24} color={theme.colorText} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: theme.sizing.large }}
        showsVerticalScrollIndicator={false}
      >
        <Column gap="large">
          {/* Appearance Section */}
          <View>
            <Typography.Subtitle
              weight="bold"
              style={{ marginBottom: 12, marginLeft: 4 }}
            >
              APPEARANCE
            </Typography.Subtitle>
            <SettingsGroup>
              <Column gap="medium" style={{ padding: 16 }}>
                <Column gap="xxSmall">
                  <Typography.Body weight="semiBold">
                    Color Theme
                  </Typography.Body>
                  <Typography.Caption type="secondary">
                    Personalize your visual experience
                  </Typography.Caption>
                </Column>
                <SegmentedTabs
                  items={themeItems}
                  selectedKey={preferences?.theme || ThemeEnum.AUTO}
                  onChange={handleThemeChange}
                  disabled={updateThemeState.isLoading}
                />
              </Column>
            </SettingsGroup>
          </View>

          {/* Notifications Section */}
          <View>
            <Typography.Subtitle
              weight="bold"
              style={{ marginBottom: 12, marginLeft: 4 }}
            >
              NOTIFICATIONS
            </Typography.Subtitle>
            <SettingsGroup>
              <Row
                align="center"
                justify="space-between"
                style={{ padding: 16 }}
              >
                <Column style={{ flex: 1 }} gap="xxSmall">
                  <Typography.Body weight="semiBold">
                    Enable Notifications
                  </Typography.Body>
                  <Typography.Caption type="secondary">
                    Get updates about your stores and orders
                  </Typography.Caption>
                </Column>
                <Switch
                  defaultChecked={preferences?.notificationsEnabled ?? true}
                  onChange={handleNotificationToggle}
                  disabled={updatePreferences.isLoading}
                  size={32}
                />
              </Row>
            </SettingsGroup>
          </View>

          {/* Regional Section */}
          <View>
            <Typography.Subtitle
              weight="bold"
              style={{ marginBottom: 12, marginLeft: 4 }}
            >
              REGIONAL & LOCALIZATION
            </Typography.Subtitle>
            <SettingsGroup>
              <TouchableOpacity activeOpacity={0.7} style={{ padding: 16 }}>
                <Row align="center" justify="space-between">
                  <Row align="center" gap="medium">
                    <LucideIcon
                      name="Globe"
                      size={20}
                      color={theme.colorPrimary}
                    />
                    <Column gap="xxSmall">
                      <Typography.Body weight="semiBold">
                        Timezone
                      </Typography.Body>
                      <Typography.Caption type="secondary">
                        Based on your current location
                      </Typography.Caption>
                    </Column>
                  </Row>
                  <Row align="center" gap="small">
                    <Typography.Body type="secondary">
                      {preferences?.timezone || "Asia/Kolkata"}
                    </Typography.Body>
                    <LucideIcon
                      name="ChevronRight"
                      size={16}
                      color={theme.colorTextQuaternary}
                    />
                  </Row>
                </Row>
              </TouchableOpacity>
              <Divider color={theme.colorBorderSecondary} />
              <TouchableOpacity activeOpacity={0.7} style={{ padding: 16 }}>
                <Row align="center" justify="space-between">
                  <Row align="center" gap="medium">
                    <LucideIcon
                      name="Languages"
                      size={20}
                      color={theme.colorPrimary}
                    />
                    <Column gap="xxSmall">
                      <Typography.Body weight="semiBold">
                        App Language
                      </Typography.Body>
                      <Typography.Caption type="secondary">
                        Language used throughout the app
                      </Typography.Caption>
                    </Column>
                  </Row>
                  <Row align="center" gap="small">
                    <Typography.Body type="secondary">
                      English (US)
                    </Typography.Body>
                    <LucideIcon
                      name="ChevronRight"
                      size={16}
                      color={theme.colorTextQuaternary}
                    />
                  </Row>
                </Row>
              </TouchableOpacity>
            </SettingsGroup>
          </View>

          {/* Legal Section */}
          <View>
            <Typography.Subtitle
              weight="bold"
              style={{ marginBottom: 12, marginLeft: 4 }}
            >
              ABOUT & LEGAL
            </Typography.Subtitle>
            <SettingsGroup>
              <TouchableOpacity activeOpacity={0.7} style={{ padding: 16 }}>
                <Row align="center" justify="space-between">
                  <Row align="center" gap="medium">
                    <LucideIcon
                      name="FileText"
                      size={20}
                      color={theme.colorTextSecondary}
                    />
                    <Typography.Body weight="semiBold">
                      Privacy Policy
                    </Typography.Body>
                  </Row>
                  <LucideIcon
                    name="ChevronRight"
                    size={16}
                    color={theme.colorTextQuaternary}
                  />
                </Row>
              </TouchableOpacity>
              <Divider color={theme.colorBorderSecondary} />
              <TouchableOpacity activeOpacity={0.7} style={{ padding: 16 }}>
                <Row align="center" justify="space-between">
                  <Row align="center" gap="medium">
                    <LucideIcon
                      name="Shield"
                      size={20}
                      color={theme.colorTextSecondary}
                    />
                    <Typography.Body weight="semiBold">
                      Terms of Service
                    </Typography.Body>
                  </Row>
                  <LucideIcon
                    name="ChevronRight"
                    size={16}
                    color={theme.colorTextQuaternary}
                  />
                </Row>
              </TouchableOpacity>
              <Divider color={theme.colorBorderSecondary} />
              <Row
                align="center"
                justify="space-between"
                style={{ padding: 16 }}
              >
                <Row align="center" gap="medium">
                  <LucideIcon
                    name="Info"
                    size={20}
                    color={theme.colorTextSecondary}
                  />
                  <Typography.Body weight="semiBold">
                    App Version
                  </Typography.Body>
                </Row>
                <Typography.Body
                  weight="bold"
                  color={theme.colorTextQuaternary}
                >
                  2.0.4
                </Typography.Body>
              </Row>
            </SettingsGroup>
          </View>
        </Column>
      </ScrollView>
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const SettingsGroup = styled.View`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: 12px;
  overflow: hidden;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;
