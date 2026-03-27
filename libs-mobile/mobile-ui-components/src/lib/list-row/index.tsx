import React from "react";
import { TouchableOpacity, ViewStyle } from "react-native";
import { Flex, Row } from "../layout/Flex";
import { Typography } from "../typography";
import { LucideIcon, LucideIconNameType } from "../lucide-icon";

interface ListRowProps {
  icon: LucideIconNameType;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  style?: ViewStyle;
  chevron?: boolean;
}

export const ListRow: React.FC<ListRowProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  style,
  chevron = true,
}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={style}>
    <Row align="center" style={{ paddingVertical: 16 }}>
      <Flex style={{ width: 32, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <LucideIcon name={icon} color={iconColor} size={22} />
      </Flex>
      <Flex style={{ flex: 1, marginLeft: 0, gap: 3 }}>
        <Typography weight="bold" variant="subtitle">
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" type="secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Flex>
      {chevron && <LucideIcon name="ChevronRight" size={18} color="#B0B0B0" />}
    </Row>
  </TouchableOpacity>
);
