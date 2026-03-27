import React from "react";
import styled from "styled-components/native";
import { View, ActivityIndicator, TouchableOpacity } from "react-native";
import { Typography } from "../typography";
import { LucideIcon, LucideIconNameType } from "../lucide-icon";
import { Flex } from "../layout/Flex";
import { Divider } from "../divider";
import { useMobileTheme } from "@nks/mobile-theme";

interface MenuItem {
  icon: LucideIconNameType | string;
  iconColor?: string;
  title: string;
  subtitle?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  showDivider?: boolean;
  rightIcon?: LucideIconNameType;
  rightIconColor?: string;
  onRightIconPress?: () => void;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

interface GroupedMenuProps {
  data: MenuGroup[];
  loading?: boolean;
  empty?: React.ReactNode;
  loader?: React.ReactNode;
  style?: object;
}

const GroupContainer = styled.View`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: 12px;
  padding: ${({ theme }) => theme.padding.xxSmall}px ${({ theme }) => theme.padding.large}px
    ${({ theme }) => theme.padding.xxSmall}px ${({ theme }) => theme.padding.small}px;
  margin-bottom: 16px;
`;

const Group: React.FC<{ children: React.ReactNode; style?: object }> = ({ children, style }) => (
  <GroupContainer style={style}>{children}</GroupContainer>
);

export const GroupedMenu: React.FC<GroupedMenuProps> = ({
  data,
  loading,
  empty,
  loader,
  style,
}) => {
  const { theme } = useMobileTheme();
  if (loading) return loader || <ActivityIndicator style={{ margin: 32 }} />;
  if (!data || data.length === 0) return empty || null;

  return (
    <View style={style}>
      {data.map((group, idx) => (
        <View key={group.label + idx} style={{ marginBottom: 1 }}>
          <Typography.Subtitle weight={"bold"} style={{ marginBottom: 12 }}>
            {group.label}
          </Typography.Subtitle>
          <Group>
            {group.items.map((item, j) => (
              <TouchableOpacity key={item.title + j} onPress={item.onPress} activeOpacity={0.8}>
                <Flex style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16 }}>
                  <Flex
                    style={{
                      width: 32,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <LucideIcon
                      name={item.icon as LucideIconNameType}
                      color={item.iconColor}
                      size={22}
                    />
                  </Flex>
                  <Flex style={{ flex: 1, marginLeft: 0, gap: 3 }}>
                    <Typography.Body weight="medium">{item.title}</Typography.Body>
                    {item.subtitle ? (
                      typeof item.subtitle === "string" ? (
                        <Typography variant="caption" type="secondary">
                          {item.subtitle}
                        </Typography>
                      ) : (
                        item.subtitle
                      )
                    ) : null}
                  </Flex>
                  {item.rightIcon ? (
                    <TouchableOpacity
                      onPress={item.onRightIconPress}
                      disabled={!item.onRightIconPress}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <LucideIcon
                        name={item.rightIcon}
                        size={18}
                        color={item.rightIconColor || "#B0B0B0"}
                      />
                    </TouchableOpacity>
                  ) : (
                    item.chevron !== false && (
                      <LucideIcon name="ChevronRight" size={18} color="#B0B0B0" />
                    )
                  )}
                </Flex>
                {(item.showDivider ?? j < group.items.length - 1) && (
                  <Divider color={theme.colorBorder} thickness={0.3} marginVertical={0} />
                )}
              </TouchableOpacity>
            ))}
          </Group>
        </View>
      ))}
    </View>
  );
};
