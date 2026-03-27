import React from "react";
import { View, StyleProp, ViewStyle } from "react-native";
import styled from "styled-components/native";
import { Typography } from "../typography";
import { SafeAreaView } from "react-native-safe-area-context";

interface HeaderProps {
  title?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Header: React.FC<HeaderProps> = ({ title, leftElement, rightElement, style }) => {
  return (
    <HeaderSafe edges={["top"]} collapsable={false}>
      <HeaderContainer style={style}>
        <SideContainer>{leftElement}</SideContainer>
        <Title numberOfLines={1}>{title}</Title>
        <SideContainer>{rightElement}</SideContainer>
      </HeaderContainer>
    </HeaderSafe>
  );
};

const HeaderSafe = styled(SafeAreaView)`
  background-color: ${({ theme }) => theme.colorBgContainer};
`;

const HeaderContainer = styled(View)`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-bottom: ${({ theme }) => theme.padding.xSmall}px;
  padding-left: ${({ theme }) => theme.padding.small}px;
  padding-right: ${({ theme }) => theme.padding.small}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-bottom-width: ${({ theme }) => theme.borderWidth.borderWidthThin}px;
  border-bottom-color: ${({ theme }) => theme.colorBorder};
`;

const Title = styled(Typography.H5)`
  flex: 1;
  text-align: center;
  color: ${({ theme }) => theme.colorText};
`;

const SideContainer = styled(View)`
  min-width: ${({ theme }) => theme.sizing.xLarge}px;
  align-items: center;
  justify-content: center;
`;
