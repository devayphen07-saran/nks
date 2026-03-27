import { useCallback } from "react";
import { useRouter } from "expo-router";
import styled from "styled-components/native";
import {
  Typography,
  Column,
  Row,
  Button,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";

export default function SelectWorkspaceScreen() {
  const router = useRouter();
  const { theme } = useMobileTheme();

  const handleSelectStore = useCallback(() => {
    router.replace("/(protected)/(workspace)/(app)/(store)/select");
  }, [router]);

  const handleSelectPersonal = useCallback(() => {
    router.replace("/(protected)/(workspace)/(app)/(personal)/dashboard");
  }, [router]);

  return (
    <Container gap="large" padding="large">
      <InstructionSection>
        <Typography.H5 weight="semiBold" color={theme.colorText}>
          Choose Your Workspace
        </Typography.H5>
        <Typography.Body color={theme.colorTextSecondary}>
          Select the workspace type you want to access.
        </Typography.Body>
      </InstructionSection>

      <WorkspaceCard onPress={handleSelectStore} activeOpacity={0.7}>
        <CardContent gap="medium">
          <IconCircle $bgColor={theme.colorPrimary}>
            <Typography.H4 weight="bold" color={theme.colorWhite}>
              🏪
            </Typography.H4>
          </IconCircle>
          <ContentColumn gap="small">
            <Typography.H5 weight="semiBold" color={theme.colorText}>
              Store Management
            </Typography.H5>
            <Typography.Caption color={theme.colorTextSecondary}>
              Manage your store operations, inventory, and orders
            </Typography.Caption>
          </ContentColumn>
        </CardContent>
      </WorkspaceCard>

      <WorkspaceCard onPress={handleSelectPersonal} activeOpacity={0.7}>
        <CardContent gap="medium">
          <IconCircle $bgColor={theme.colorSuccess}>
            <Typography.H4 weight="bold" color={theme.colorWhite}>
              👤
            </Typography.H4>
          </IconCircle>
          <ContentColumn gap="small">
            <Typography.H5 weight="semiBold" color={theme.colorText}>
              Personal Workspace
            </Typography.H5>
            <Typography.Caption color={theme.colorTextSecondary}>
              Access your personal account and preferences
            </Typography.Caption>
          </ContentColumn>
        </CardContent>
      </WorkspaceCard>
    </Container>
  );
}

const Container = styled(Column)`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const InstructionSection = styled(Column)`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.regular}px;
  padding: ${({ theme }) => theme.sizing.medium}px;
  gap: ${({ theme }) => theme.sizing.small}px;
`;

const WorkspaceCard = styled.TouchableOpacity`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.regular}px;
  border-width: 2px;
  border-color: ${({ theme }) => theme.colorBorder};
  padding: ${({ theme }) => theme.sizing.medium}px;
`;

const CardContent = styled(Row)`
  align-items: center;
`;

const IconCircle = styled.View<{ $bgColor: string }>`
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background-color: ${({ $bgColor }) => $bgColor};
  justify-content: center;
  align-items: center;
`;

const ContentColumn = styled(Column)`
  flex: 1;
`;
