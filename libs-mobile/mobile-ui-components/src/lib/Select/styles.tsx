import styled from "styled-components/native";
import { Animated, Platform, TouchableOpacity, View } from "react-native";

export const SelectGenericContainer = styled.View(({ theme }) => ({
  paddingBottom: 13,
}));

export const SelectBackdrop = styled.Pressable({
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.18)',
});

export const SelectAnimatedSheetContainer = styled(Animated.View)(({ theme }) => ({
  backgroundColor: theme.colorBgLayout,
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  paddingTop: 14,
  minHeight: 260,
  maxHeight: '80%',
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
}));

export const SelectSheetBar = styled(View)({
  alignSelf: 'center',
  width: 44,
  height: 6,
  borderRadius: 3,
  backgroundColor: '#e5e7eb',
  marginBottom: 10,
});

export const Separator = styled(View)(({ theme }) => ({
  height: 1,
  backgroundColor: theme.colorBorder,
  marginLeft: theme.margin?.xSmall ?? 0,
  marginRight: theme.margin?.xSmall ?? 0,
}));
export const inputStylesCss = ({ $hasError, theme }: any) => ({
  borderWidth: theme.borderWidth?.borderWidthThin ?? 1,
  borderColor: $hasError ? theme.colorError : theme.colorBorder,
  borderRadius: theme.borderRadius?.medium ?? 8,
  padding: theme.padding?.small ?? 8,
  fontSize: theme.fontSize?.medium ?? 14,
  fontFamily: theme.fontFamily?.poppinsRegular,
  color: theme.colorText,
});

export const SelectLabelText = styled.Text(({ theme }) => ({
  fontSize: theme.fontSize?.small ?? 12,
  fontFamily: theme.fontFamily?.poppinsRegular,
  color: theme.colorText,
}));
interface SelectTouchableProps extends React.ComponentProps<typeof TouchableOpacity> {
  $hasError?: boolean;
}

export const SelectTouchable = styled(TouchableOpacity)<SelectTouchableProps>(({ $hasError, theme }) => ({
  ...inputStylesCss({ $hasError, theme }),
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: Platform.OS === 'ios' ? theme.padding?.small ?? 8 : 10,
  backgroundColor: theme.colorBgContainer,
  borderWidth: theme.borderWidth?.borderWidthThin ?? 1,
  borderColor: $hasError ? theme.colorError : theme.colorBorder,
  borderRadius: theme.borderRadius?.medium ?? 8,
}));
