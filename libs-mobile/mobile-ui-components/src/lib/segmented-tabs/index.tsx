import React from "react";
import { Platform, ViewStyle } from "react-native";
import styled, { css } from "styled-components/native";
import { Typography } from "../typography";

export type SegmentedTabItem = {
  key: string;
  label: string;
  iconElement?: React.ReactNode;
  disabled?: boolean;
};

export type SegmentedTabsProps = {
  items: SegmentedTabItem[];
  selectedKey?: string;
  onChange: (key: string) => void;
  style?: ViewStyle;
  size?: "xSmall" | "small" | "medium" | "large";
  disabled?: boolean;
  fullWidth?: boolean;
  showBottomLine?: boolean;
};

const sizeConfig = {
  xSmall: { padding: 2, fontSize: 12 },
  small: { padding: 6, fontSize: 12 },
  medium: { padding: 10, fontSize: 14 },
  large: { padding: 12, fontSize: 16 },
};

export function SegmentedTabs({
  items,
  selectedKey,
  onChange,
  style,
  size = "medium",
  disabled = false,
  fullWidth = true,
  showBottomLine = false,
}: SegmentedTabsProps) {
  return (
    <Container
      style={style}
      accessibilityRole="tablist"
      $fullWidth={fullWidth}
      $showBottomLine={showBottomLine}
    >
      {items.map((item) => {
        const selected = item.key === selectedKey;
        const isDisabled = disabled || item.disabled;

        return (
          <TabButton
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: isDisabled }}
            onPress={() => !isDisabled && onChange(item.key)}
            activeOpacity={0.85}
            disabled={isDisabled}
            $fullWidth={fullWidth}
          >
            <Inner
              $selected={selected}
              $size={size}
              $disabled={isDisabled}
              $showBottomLine={showBottomLine}
            >
              {item.iconElement && (
                <IconWrap $selected={selected} $disabled={isDisabled}>
                  {item.iconElement}
                </IconWrap>
              )}

              <Typography.Caption
                weight="semiBold"
                style={{ opacity: isDisabled ? 0.5 : 1 }}
              >
                {item.label}
              </Typography.Caption>
            </Inner>

            {showBottomLine && selected && <BottomLine />}
          </TabButton>
        );
      })}
    </Container>
  );
}

/* ---------------------------------- */
/* Styled components                   */
/* ---------------------------------- */

const Container = styled.View<{
  $fullWidth?: boolean;
  $showBottomLine?: boolean;
}>`
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  width: ${({ $fullWidth }) => ($fullWidth ? "100%" : "auto")};
  background-color: ${({ theme, $showBottomLine }) =>
    !$showBottomLine ? theme.colorBgLayout || "#f5f5f5" : "transparent"};
  border-bottom-width: ${({ $showBottomLine }) => ($showBottomLine ? 1 : 0)}px;
  border-bottom-color: ${({ theme, $showBottomLine }) =>
    $showBottomLine ? theme.colorBorder || "#e0e0e0" : "transparent"};
  border-radius: ${({ theme, $showBottomLine }) =>
    !$showBottomLine ? theme.borderRadius?.large || 12 : 0}px;
  padding: ${({ $showBottomLine }) => (!$showBottomLine ? 4 : 0)}px;
`;

const TabButton = styled.TouchableOpacity<{
  $fullWidth?: boolean;
}>`
  flex: ${({ $fullWidth }) => ($fullWidth ? 1 : "none")};
  border-radius: ${({ theme }) => theme.borderRadius?.medium || 8}px;
`;

const Inner = styled.View<{
  $selected: boolean;
  $size: keyof typeof sizeConfig;
  $disabled?: boolean;
  $showBottomLine?: boolean;
}>`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding-top: ${({ $size }) => sizeConfig[$size].padding}px;
  padding-bottom: ${({ $size }) => sizeConfig[$size].padding}px;
  padding-left: ${({ $size }) => sizeConfig[$size].padding + 2}px;
  padding-right: ${({ $size }) => sizeConfig[$size].padding + 2}px;
  border-radius: ${({ theme, $showBottomLine }) =>
    $showBottomLine ? 0 : theme.borderRadius?.medium || 8}px;
  overflow: hidden;
  background-color: ${({ theme, $showBottomLine, $selected, $disabled }) =>
    !$showBottomLine && $selected && !$disabled
      ? theme.colorBgContainer
      : "transparent"};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};

  ${({ $selected, $disabled, $showBottomLine }) =>
    $selected &&
    !$disabled &&
    !$showBottomLine &&
    Platform.select({
      ios: css`
        shadow-color: #000;
        shadow-opacity: 0.1;
        shadow-radius: 4px;
        shadow-offset: 0px 2px;
      `,
      android: css`
        elevation: 2;
      `,
    })}
`;

const IconWrap = styled.View<{ $selected: boolean; $disabled?: boolean }>`
  opacity: ${({ $selected, $disabled }) =>
    $disabled ? 0.5 : $selected ? 1 : 0.7};
`;

const BottomLine = styled.View`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background-color: ${({ theme }) => theme.colorPrimary};
  border-radius: 2px;
`;

export default SegmentedTabs;
