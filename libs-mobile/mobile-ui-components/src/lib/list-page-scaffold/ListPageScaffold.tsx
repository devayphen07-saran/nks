import React, { PropsWithChildren } from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";
import { ListPageHeader } from "./ListPageHeader";
import { LucideIcon, LucideIconNameType } from "../lucide-icon";
import { useMobileTheme } from "@nks/mobile-theme";

interface ListScaffoldProps {
  onPressLeft: () => void;
  rightIcon?: LucideIconNameType;
  onPressRight?: () => void;
  title: string;
  filterAndSearch: React.ReactNode;
}

export function ListPageScaffold({
  children,
  onPressLeft,
  onPressRight,
  rightIcon = "Plus",
  title,
  filterAndSearch,
}: PropsWithChildren<ListScaffoldProps>) {
  const insets = useSafeAreaInsets();
  const { theme } = useMobileTheme();

  return (
    <Container>
      {/* For Status bar spacing */}
      <StatusPadding style={{ height: insets.top }}></StatusPadding>
      <ListPageHeader
        title={title}
        leftElement={
          <TouchableOpacity onPress={onPressLeft}>
            <LucideIcon name={"ArrowLeft"} size={22} />
          </TouchableOpacity>
        }
        rightElement={
          onPressRight ? (
            <TouchableOpacity onPress={onPressRight}>
              <LucideIcon name={rightIcon} size={22} color={theme.colorPrimary} />
            </TouchableOpacity>
          ) : null
        }
      />
      <StickyContainer>{filterAndSearch}</StickyContainer>

      {children}
    </Container>
  );
}

export const SearchInputContainer = styled(View)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: 5,
  backgroundColor: theme.colorBgContainer,
  bottom: 0,
}));

const StatusPadding = styled(View)(({ theme }) => ({
  backgroundColor: theme.colorBgContainer,
}));

const Container = styled(View)(({ theme }) => ({
  flex: 1,
  backgroundColor: theme.colorBgLayout,
}));

const StickyContainer = styled(View)(({ theme }) => ({
  padding: theme.padding.xSmall,
  paddingBottom: theme.padding.medium,
  backgroundColor: theme.colorBgContainer,
  borderBottomWidth: 0.4,
  borderBottomColor: theme.colorBorder,
}));
