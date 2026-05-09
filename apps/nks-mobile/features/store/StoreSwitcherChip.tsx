import React from "react";
import { TouchableOpacity } from "react-native";
import styled from "styled-components/native";
import { LucideIcon, Typography } from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";

interface Props {
  storeName: string | null;
  onPress: () => void;
}

/**
 * Chip-style trigger for the store switcher.
 *
 *   ┌──────────────────────────────┐
 *   │ 🏪  Store Name        ▾      │
 *   └──────────────────────────────┘
 *
 * Used as the centerElement of the home header. Tapping it opens the
 * StoreSwitcherSheet. Falls back to "Select store" when no store is active.
 */
export function StoreSwitcherChip({ storeName, onPress }: Props) {
  const { theme } = useMobileTheme();
  const label = storeName ?? "Select store";

  return (
    <ChipTouchable onPress={onPress} activeOpacity={0.7}>
      <IconBg>
        <LucideIcon name="Store" size={14} color={theme.colorPrimary} />
      </IconBg>
      <Label numberOfLines={1}>{label}</Label>
      <LucideIcon name="ChevronDown" size={16} color={theme.colorTextSecondary} />
    </ChipTouchable>
  );
}

const ChipTouchable = styled(TouchableOpacity)`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 6px 6px;
  border-radius: 999px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
  background-color: ${({ theme }) => theme.colorBgContainer};
`;

const IconBg = styled.View`
  width: 24px;
  height: 24px;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colorPrimaryBg};
  align-items: center;
  justify-content: center;
`;

const Label = styled(Typography.Body)`
  color: ${({ theme }) => theme.colorText};
  max-width: 120px;
`;
