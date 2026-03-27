import React, { ReactNode } from "react";
import { Modal, View, TouchableOpacity } from "react-native";
import styled from "styled-components/native";
import { useMobileTheme } from "@nks/mobile-theme";
import { SafeAreaView } from "react-native-safe-area-context";

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  height?: number;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  title,
  headerLeft,
  headerRight,
  children,
  height = 600,
}) => {
  const { theme } = useMobileTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <ModalBackdrop activeOpacity={1} onPress={onClose}>
        <ModalContainer $height={height} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
            {/* Handle Bar */}
            <HandleContainer>
              <HandleBar />
            </HandleContainer>

            {/* Header */}
            {(title || headerLeft || headerRight) && (
              <HeaderContainer>
                <HeaderLeft>{headerLeft}</HeaderLeft>
                <HeaderTitle>
                  {title && <HeaderText style={{ color: theme.colorText }}>{title}</HeaderText>}
                </HeaderTitle>
                <HeaderRight>{headerRight}</HeaderRight>
              </HeaderContainer>
            )}

            {/* Content */}
            <ContentContainer>{children}</ContentContainer>
          </SafeAreaView>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

const ModalBackdrop = styled(TouchableOpacity)({
  flex: 1,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  justifyContent: "flex-end",
});

const ModalContainer = styled(TouchableOpacity)<{ $height: number }>(({ theme, $height }) => ({
  backgroundColor: theme.colorBgContainer,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  height: $height,
  overflow: "hidden",
}));

const HandleContainer = styled(View)({
  alignItems: "center",
  paddingVertical: 12,
});

const HandleBar = styled(View)(({ theme }) => ({
  width: 40,
  height: 4,
  borderRadius: 2,
  backgroundColor: theme.colorBorder,
}));

const HeaderContainer = styled(View)(({ theme }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: theme.padding.medium,
  paddingVertical: theme.padding.small,
  borderBottomWidth: 1,
  borderBottomColor: theme.colorBorderSecondary,
}));

const HeaderLeft = styled(View)({
  flex: 1,
  alignItems: "flex-start",
});

const HeaderTitle = styled(View)({
  flex: 2,
  alignItems: "center",
});

const HeaderText = styled.Text({
  fontSize: 18,
  fontWeight: "600",
});

const HeaderRight = styled(View)({
  flex: 1,
  alignItems: "flex-end",
});

const ContentContainer = styled(View)({
  flex: 1,
});

export default BottomSheetModal;
