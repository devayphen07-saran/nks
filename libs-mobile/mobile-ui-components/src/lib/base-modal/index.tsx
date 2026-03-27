import React from "react";
import {
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  ModalProps,
} from "react-native";
import styled from "styled-components/native";

const { height, width } = Dimensions.get("window");

export interface BaseModalProps {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  animationType?: ModalProps["animationType"];
  transparent?: boolean;
  backdropColor?: string;
  position?: "center" | "bottom" | "top";
  disableBackdropPress?: boolean;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  visible,
  onClose,
  children,
  animationType = "slide",
  transparent = true,
  backdropColor = "rgba(0,0,0,0.5)",
  position = "center",
  disableBackdropPress = false,
}) => {
  const handleBackdropPress = () => {
    if (!disableBackdropPress && onClose) {
      onClose();
    }
  };

  return (
    <Modal
      animationType={animationType}
      transparent={transparent}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <Backdrop $backdropColor={backdropColor}>
          <TouchableWithoutFeedback>
            <ModalContainer $position={position}>{children}</ModalContainer>
          </TouchableWithoutFeedback>
        </Backdrop>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const Backdrop = styled.View<{ $backdropColor: string }>`
  flex: 1;
  justify-content: center;
  align-items: center;
  background-color: ${({ $backdropColor }) => $backdropColor};
`;

const ModalContainer = styled.View<{ $position: "center" | "bottom" | "top" }>`
  background-color: ${({ theme }) => theme.colorBgContainer || "white"};
  border-radius: 12px;
  padding: 20px;
  width: ${width * 0.9}px;
  max-height: ${height * 0.8}px;

  ${({ $position }) => {
    switch ($position) {
      case "bottom":
        return `
          position: absolute;
          bottom: 0px;
          width: ${width}px;
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
          padding-bottom: 30px;
        `;
      case "top":
        return `
          position: absolute;
          top: 0px;
          width: ${width}px;
          border-bottom-left-radius: 20px;
          border-bottom-right-radius: 20px;
        `;
      default:
        return `
          justify-content: center;
        `;
    }
  }}
`;
