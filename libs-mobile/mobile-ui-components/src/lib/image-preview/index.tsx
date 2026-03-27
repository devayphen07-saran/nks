import React, { useState } from "react";
import { ActivityIndicator, Modal, TouchableOpacity, TouchableWithoutFeedback } from "react-native";
import styled from "styled-components/native";
import { X } from "lucide-react-native";
import { ColorType } from "@nks/mobile-theme";
import { LucideIcon, LucideIconNameType } from "../lucide-icon";

interface BorderConfig {
  showBorder?: boolean;
  color?: string;
  width?: number;
}

interface ImagePreviewProps {
  uri?: string;
  size?: number;
  iconSize?: number;
  borderRadius?: number;
  fallbackIcon?: LucideIconNameType;
  previewEnabled?: boolean;
  fallbackBgColor?: string;
  fallbackIconColor?: string;
  border?: BorderConfig;
  loading?: boolean;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  uri,
  size = 70,
  iconSize,
  borderRadius = 0,
  fallbackIcon = "Image",
  previewEnabled = true,
  fallbackBgColor,
  fallbackIconColor,
  border,
  loading,
}) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  const handlePress = () => {
    if (previewEnabled && uri && !error) setOpen(true);
  };

  const showFallback = !uri || error;

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
        <Wrapper
          size={size}
          borderRadius={borderRadius}
          fallbackBgColor={fallbackBgColor}
          borderConfig={border}
        >
          {loading ? (
            <Centered>
              <ActivityIndicator color={ColorType.grey} />
            </Centered>
          ) : showFallback ? (
            <Centered>
              <LucideIcon
                name={fallbackIcon}
                color={fallbackIconColor || ColorType.grey}
                size={iconSize || size * 0.4}
              />
            </Centered>
          ) : (
            <>
              {imageLoading && (
                <Centered>
                  <ActivityIndicator color={ColorType.grey} />
                </Centered>
              )}
              <StyledImage
                source={{ uri }}
                resizeMode="cover"
                borderRadius={borderRadius}
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={() => {
                  setError(true);
                  setImageLoading(false);
                }}
              />
            </>
          )}
        </Wrapper>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <ModalContainer>
            <TouchableOpacity
              style={{ position: "absolute", top: 50, right: 10, zIndex: 2 }}
              onPress={() => setOpen(false)}
            >
              <X color="#fff" size={28} />
            </TouchableOpacity>

            <PreviewImage source={{ uri }} resizeMode="contain" onError={() => setError(true)} />
          </ModalContainer>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const Wrapper = styled.View<{
  size: number;
  borderRadius: number;
  fallbackBgColor?: string;
  borderConfig?: BorderConfig;
}>(({ theme, size, borderRadius, fallbackBgColor, borderConfig }) => ({
  width: size,
  height: size,
  borderRadius,
  overflow: "hidden",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: fallbackBgColor || theme.colorBgLayout,
  borderWidth: borderConfig?.showBorder ? (borderConfig?.width ?? 1) : 0,
  borderColor: borderConfig?.color ?? "transparent",
}));

const StyledImage = styled.Image<{ borderRadius: number }>`
  width: 100%;
  height: 100%;
  border-radius: ${({ borderRadius }) => borderRadius}px;
`;

const Centered = styled.View`
  justify-content: center;
  align-items: center;
  flex: 1;
`;

const ModalContainer = styled.View`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.9);
  justify-content: center;
  align-items: center;
`;

const PreviewImage = styled.Image`
  width: 90%;
  height: 80%;
`;
