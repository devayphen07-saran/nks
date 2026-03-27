import React from "react";
import { TouchableOpacity, View } from "react-native";
import styled from "styled-components/native";
import { LucideIcon } from "../lucide-icon";
import { Typography } from "../typography";

export interface ListPageHeaderProps {
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  onClickMenu?: () => void;
  title: string;
}

export function ListPageHeader({
  leftElement,
  rightElement,
  onClickMenu,
  title,
}: ListPageHeaderProps) {
  return (
    <HeaderContainer>
      <SideContainer>
        {!leftElement ? (
          <TouchableOpacity onPress={onClickMenu}>
            <LucideIcon name="Menu" size={20} />
          </TouchableOpacity>
        ) : (
          leftElement
        )}
      </SideContainer>
      <Typography.H5 numberOfLines={1}>{title}</Typography.H5>
      <SideContainer>{rightElement}</SideContainer>
    </HeaderContainer>
  );
}

const HeaderContainer = styled(View)(({ theme }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: theme.padding.xSmall,
  paddingBottom: theme.padding.xSmall,
  backgroundColor: theme.colorBgContainer,
}));

const SideContainer = styled(View)(() => ({
  minWidth: 32,
  alignItems: "center",
  justifyContent: "center",
}));
