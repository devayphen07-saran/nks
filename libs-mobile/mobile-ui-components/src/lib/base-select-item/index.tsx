import React from "react";
import { TouchableOpacity, TouchableOpacityProps, View } from "react-native";
import styled from "styled-components/native";
import { useMobileTheme } from "@nks/mobile-theme";
import { Avatar } from "../avatar";
import { Flex, Row } from "../layout";
import { Typography } from "../typography";
import { LucideIcon, LucideIconNameType } from "../lucide-icon";

export interface BaseSelectItemProps extends TouchableOpacityProps {
  title: string | undefined;
  subTitle?: string | undefined;
  imageUrl?: string;
  isSelected: boolean;
  iconName?: LucideIconNameType;
  rightText?: string;
  titleTag?: string;
  disabled?: boolean;
}

export const BaseSelectItem = (props: BaseSelectItemProps) => {
  const { theme } = useMobileTheme();
  const {
    title,
    titleTag,
    disabled = false,
    subTitle,
    imageUrl,
    isSelected,
    rightText,
    iconName,
    ...touchProps
  } = props;

  const hasSubtitle = Boolean(subTitle && subTitle.trim() !== "");

  return (
    <BaseItemContainer
      $isSelected={isSelected}
      {...touchProps}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Row padding={"xxSmall"} justify="space-between" align="center">
        <Row gap={"small"} align="center" style={{ flex: 1 }}>
          <Avatar
            // disabled={disabled} // Avatar doesn't seem to have disabled prop in local version, check if needed
            uri={imageUrl}
            initials={iconName ? undefined : title}
            iconName={iconName}
            size={40}
          />
          <Flex
            style={{
              justifyContent: hasSubtitle ? "flex-start" : "center",
              flex: 1,
            }}
          >
            <Row gap={7} align="center">
              <Typography.Subtitle
                weight={"medium"}
                type={disabled ? "secondary" : "default"}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {title}
              </Typography.Subtitle>
              {titleTag && (
                <TagContainer>
                  <Typography.Overline weight={"semiBold"} style={{ color: theme.colorWhite }}>
                    {titleTag}
                  </Typography.Overline>
                </TagContainer>
              )}
            </Row>

            {hasSubtitle && (
              <Typography.Caption type="secondary" numberOfLines={1} ellipsizeMode="tail">
                {subTitle}
              </Typography.Caption>
            )}
          </Flex>
        </Row>

        <Row gap={"small"} align="center">
          {rightText && (
            <Typography.H5 weight={"bold"} type="default">
              {rightText}
            </Typography.H5>
          )}
          {isSelected && <LucideIcon name="Check" color={theme.colorPrimary} size={20} />}
        </Row>
      </Row>
    </BaseItemContainer>
  );
};

const TagContainer = styled(View)(({ theme }) => ({
  backgroundColor: theme.color.primary.text,
  borderRadius: 10,
  paddingHorizontal: 7,
  height: 17,
  alignItems: "center",
  justifyContent: "center",
}));

const BaseItemContainer = styled(TouchableOpacity)<{ $isSelected: boolean }>(
  ({ theme, $isSelected }) => ({
    margin: theme.margin.xSmall,
    paddingVertical: theme.padding.medium,
    paddingHorizontal: theme.padding.small,
    // width: "100%", // Let container define width
    borderRadius: theme.borderRadius.medium,
    backgroundColor: $isSelected ? theme.colorBgElevated : theme.colorBgContainer, // Visual feedback for selection if needed, or transparent? User snippet didn't have bg color.
    // Actually user snippet had NO background color specified in styled component, maybe transparent.
    // But usually list items have a background. Let's stick to theme.colorBgContainer and maybe a border or slight bg change if selected.
    borderWidth: 1,
    borderColor: $isSelected ? theme.colorPrimary : theme.colorBorder,
  })
);
