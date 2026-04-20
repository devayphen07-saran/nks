import React, { ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Modal, View, Text, Pressable } from "react-native";
import styled from "styled-components/native";
import { Flex } from "../layout";
import { LucideIcon } from "../lucide-icon";
import { useMobileTheme } from "@nks/mobile-theme";
import { ThemedFlatList } from "../flat-list-scaffold/ThemedFlatList";

type valueType = string | number | undefined | null;

export interface ModalSelectProps<T> {
  options: T[];
  renderItem: (value: T, onSelectItem: (value: T) => void, isSelected: boolean) => ReactElement;
  onChange: (value: T) => void;
  value?: valueType;
  valueKey: keyof T;
  keyExtractor?: ((item: T, index: number) => string) | undefined;
  open: boolean;
  setOpen: (value: boolean) => void;
  loading?: boolean;
  loadingRenderer?: () => ReactElement;
  noDataMessage?: string;
  Header?: React.ReactNode;
}

export function ModalSelect<T>({
  options,
  renderItem,
  value,
  onChange,
  valueKey,
  keyExtractor,
  open,
  setOpen,
  loading,
  loadingRenderer,
  noDataMessage = "No Data Found",
  Header,
}: ModalSelectProps<T>) {
  const [showing, setShowing] = useState(open);
  const sheetAnim = useRef(new Animated.Value(1)).current;
  const screenHeight = Dimensions.get("window").height;
  const { theme } = useMobileTheme();

  useEffect(() => {
    if (open) {
      setShowing(true);
      sheetAnim.setValue(1);
      Animated.timing(sheetAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(sheetAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setShowing(false));
    }
  }, [open, sheetAnim]);

  const translateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenHeight],
  });

  const selectedValue = useMemo(() => {
    return options.find((item) => item?.[valueKey] === value);
  }, [value, options, valueKey]);

  return (
    <Modal visible={showing} transparent animationType="none" onRequestClose={() => setOpen(false)}>
      <Backdrop onPress={() => setOpen(false)} />
      <AnimatedSheetContainer style={{ transform: [{ translateY }] }}>
        <SheetBar />
        {Header}
        {loading ? (
          loadingRenderer ? (
            loadingRenderer()
          ) : null
        ) : options.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              paddingVertical: 20,
            }}
          >
            <Flex align="center" gap={10}>
              <LucideIcon name={"Box"} size={40} color={theme.color.default.active} />
              <NoDataText>{noDataMessage}</NoDataText>
            </Flex>
          </View>
        ) : (
          <ThemedFlatList
            data={options}
            keyExtractor={
              keyExtractor || ((item, index) => String(item[valueKey]) + index)
            }
            scrollEnabled={true}
            renderItem={(info: { item: T; index: number }) =>
              renderItem(
                info.item,
                (i) => {
                  onChange(i);
                  setOpen(false);
                },
                selectedValue?.[valueKey] === info.item[valueKey]
              )
            }
            ItemSeparatorComponent={() => <Separator />}
            loading={false}
          />
        )}
      </AnimatedSheetContainer>
    </Modal>
  );
}

const Backdrop = styled(Pressable)(() => ({
  flex: 1,
  backgroundColor: "rgba(0, 0, 0, 0.18)",
}));

const AnimatedSheetContainer = styled(Animated.View)(({ theme }) => ({
  backgroundColor: theme.colorBgLayout,
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  paddingTop: 14,
  paddingBottom: 15,
  paddingRight: 0,
  paddingLeft: 0,
  minHeight: 220,
  maxHeight: "50%",
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
}));

const Separator = styled(View)(({ theme }) => ({
  height: 0.5,
  backgroundColor: theme.colorBorder,
  marginHorizontal: theme.margin.small,
}));

const SheetBar = styled(View)(() => ({
  alignSelf: "center",
  width: 44,
  height: 6,
  borderRadius: 3,
  backgroundColor: "#e5e7eb",
  marginBottom: 10,
}));

const NoDataText = styled(Text)(({ theme }) => ({
  color: theme.color.default.active,
  fontSize: 15,
}));
