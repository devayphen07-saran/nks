import React, { useState } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import styled from "styled-components/native";
import {
  Typography,
  Button,
  Column,
  Row,
  LucideIcon,
  Header,
  Input,
  Avatar,
  GroupedMenu,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useAuthUser } from "../../store";
import {
  useUserProfileForm,
  ProfileFormValues,
} from "./hooks/useUserProfileForm";
import { router } from "expo-router";

export function UserProfileScreen() {
  const { theme } = useMobileTheme();
  const user = useAuthUser();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useUserProfileForm(user as any);
  const { control, handleSubmit, reset } = form;

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      // TODO: Dispatch updateUserDetails API call
      console.log("Updating profile with:", values);
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred");
    }
  };

  const handleBack = () => {
    if (isEditing) {
      setIsEditing(false);
      reset();
    } else {
      router.back();
    }
  };

  const menuData = [
    {
      label: "Account Preferences",
      items: [
        {
          icon: "Lock",
          title: "Update Password",
          subtitle: "Change your account password regularly",
          onPress: () => Alert.alert("Coming Soon", "Security settings will be available in the next update."),
        },
        {
          icon: "Settings",
          title: "App Settings",
          subtitle: "Theme, Language and Notifications",
          onPress: () => router.push("/(protected)/(store)/settings"),
        },
      ],
    },
    {
      label: "Support",
      items: [
        {
          icon: "HelpCircle",
          title: "Help & Support",
          onPress: () => Alert.alert("Support", "Contact support@nammakadai.com for assistance."),
        },
        {
          icon: "FileText",
          title: "Legal & Privacy",
          onPress: () => Alert.alert("Legal", "Privacy policy and terms of service."),
        },
      ],
    },
  ];

  return (
    <Container>
      <Header
        title="Account Profile"
        leftElement={
          <TouchableOpacity onPress={handleBack}>
            <LucideIcon name="ChevronLeft" size={24} color={theme.colorText} />
          </TouchableOpacity>
        }
        rightElement={
          !isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Typography.Body weight="bold" color={theme.colorPrimary}>
                Edit
              </Typography.Body>
            </TouchableOpacity>
          )
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Section */}
          <HeroHeader>
            <AvatarContainer>
              <Avatar
                initials={user?.name?.substring(0, 2) || "U"}
                size={100}
                bgColor={theme.colorPrimary}
                showBorder
                borderWidth={4}
                borderColor={theme.colorWhite}
              />
            </AvatarContainer>
          </HeroHeader>

          <Content>
            <ProfileInfo align="center">
              <Typography.H4 weight="bold">{user?.name || "N/A"}</Typography.H4>
              <Typography.Body type="secondary">{user?.email || "Email not linked"}</Typography.Body>
            </ProfileInfo>

            {isEditing ? (
              <EditSection gap="medium">
                <Typography.H5 weight="semiBold" style={{ marginBottom: 8 }}>
                  Personal Information
                </Typography.H5>
                <Column gap="small">
                  <Input
                    name="name"
                    control={control}
                    label="Display Name"
                    placeholder="Enter your name"
                    disabled={isLoading}
                    required
                  />
                  <Input
                    name="email"
                    control={control}
                    label="Primary Email"
                    placeholder="Enter your email"
                    inputDataType="email"
                    disabled={isLoading}
                  />
                  <Input
                    name="phoneNumber"
                    control={control}
                    label="Mobile Number"
                    placeholder="Enter your phone number"
                    inputDataType="phoneNumber"
                    disabled={isLoading}
                  />
                </Column>
                <Footer gap="medium">
                  <Button
                    onPress={handleSubmit(onSubmit)}
                    variant="primary"
                    loading={isLoading}
                    disabled={isLoading}
                    label="Save Changes"
                  />
                  <Button
                    onPress={() => {
                      setIsEditing(false);
                      reset();
                    }}
                    variant="default"
                    disabled={isLoading}
                    label="Cancel"
                  />
                </Footer>
              </EditSection>
            ) : (
              <Column gap="large">
                <InfoCard gap="medium">
                  <Typography.Subtitle weight="bold" color={theme.colorTextSecondary}>
                    ACCOUNT INFORMATION
                  </Typography.Subtitle>
                  <Divider />
                  <DetailRow label="Phone" value={user?.phoneNumber || "Not set"} icon="Phone" />
                  <DetailRow label="Email" value={user?.email || "Not linked"} icon="Mail" />
                  <DetailRow label="Joined" value="March 2024" icon="Calendar" />
                </InfoCard>

                <GroupedMenu data={menuData} />
              </Column>
            )}
          </Content>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

function DetailRow({ label, value, icon }: { label: string; value: string; icon: any }) {
  const { theme } = useMobileTheme();
  return (
    <Row align="center" justify="space-between" style={{ paddingVertical: 4 }}>
      <Row align="center" gap="medium">
        <LucideIcon name={icon} size={18} color={theme.colorTextQuaternary} />
        <Typography.Body type="secondary">{label}</Typography.Body>
      </Row>
      <Typography.Body weight="medium">{value}</Typography.Body>
    </Row>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const HeroHeader = styled.View`
  height: 120px;
  background-color: ${({ theme }) => theme.colorPrimary};
  position: relative;
  margin-bottom: 50px;
`;

const AvatarContainer = styled.View`
  position: absolute;
  bottom: -40px;
  align-self: center;
  z-index: 10;
`;

const Content = styled.View`
  padding: ${({ theme }) => theme.sizing.large}px;
`;

const ProfileInfo = styled(Column)`
  margin-bottom: ${({ theme }) => theme.sizing.xLarge}px;
`;

const InfoCard = styled(Column)`
  background-color: ${({ theme }) => theme.colorBgContainer};
  padding: ${({ theme }) => theme.sizing.large}px;
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const EditSection = styled(Column)`
  background-color: ${({ theme }) => theme.colorBgContainer};
  padding: ${({ theme }) => theme.sizing.large}px;
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const Footer = styled(Column)`
  margin-top: ${({ theme }) => theme.sizing.large}px;
`;

const Divider = styled.View`
  height: 1px;
  background-color: ${({ theme }) => theme.colorBorderSecondary};
`;
