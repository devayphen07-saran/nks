import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LucideIcon } from "../lucide-icon";
import { ReactNode, useRef } from "react";
import { Animated, ScrollViewProps, TouchableOpacity, View } from "react-native";
import { TypographyAnimated } from "../typography/typography-animated";
import styled from "styled-components/native";

interface Props {
  title: string;
  children?: ReactNode;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  scrollViewProps?: ScrollViewProps;
  onClickMenu?: () => void;
}

export function AppLayout({
  children,
  title,
  rightElement,
  scrollViewProps,
  leftElement,
  onClickMenu,
}: Props) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <HeaderSafe style={{ paddingTop: insets.top }}>
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

          <TypographyAnimated.H5 style={{ flex: 1, textAlign: "center" }} numberOfLines={1}>
            {title}
          </TypographyAnimated.H5>

          <SideContainer>{rightElement}</SideContainer>
        </HeaderContainer>
      </HeaderSafe>
      <ScrollViewContainer
        {...scrollViewProps}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollViewContainer>
    </View>
  );
}

export default AppLayout;

const HeaderSafe = styled(View)`
  background-color: ${({ theme }) => theme.colorBgContainer};
`;

const HeaderContainer = styled(View)`
  min-height: 35px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.padding.xSmall}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-bottom-width: 0.3px;
  border-bottom-color: ${({ theme }) => theme.colorBorder};
`;
const ScrollViewContainer = styled(Animated.ScrollView)`
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const SideContainer = styled(View)`
  min-width: 32px;
  align-items: center;
  justify-content: center;
`;
