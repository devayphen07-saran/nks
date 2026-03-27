import React from "react";
import styled from "styled-components/native";
import { useMobileTheme } from "@nks/mobile-theme";
import { Button } from "../button";
import { LucideIcon } from "../lucide-icon";
import { Typography } from "../typography";
import { LucideIconNameType } from "../lucide-icon";

interface NoDataContainerProps {
  message: string;
  description?: string;
  iconName?: LucideIconNameType;
  buttonProps?: {
    buttonText: string;
    onPress: () => void;
  };
}

export const NoDataContainer: React.FC<NoDataContainerProps> = ({
  message,
  description,
  iconName = "Database",
  buttonProps,
}) => {
  const { theme } = useMobileTheme();

  return (
    <Container>
      <IconWrapper>
        <LucideIcon name={iconName} size={48} color={theme.color.primary.main} />
      </IconWrapper>
      <Typography.H4 style={{ textAlign: "center", marginBottom: 8 }}>{message}</Typography.H4>
      {description && (
        <Typography.Body type="secondary" style={{ textAlign: "center", marginBottom: 24 }}>
          {description}
        </Typography.Body>
      )}
      {buttonProps && (
        <Button variant="primary" label={buttonProps.buttonText} onPress={buttonProps.onPress} />
      )}
    </Container>
  );
};

const Container = styled.View`
  align-items: center;
  justify-content: center;
  padding: 24px;
  flex: 1;
`;

const IconWrapper = styled.View`
  padding: 20px;
  border-radius: 50px;
`;
