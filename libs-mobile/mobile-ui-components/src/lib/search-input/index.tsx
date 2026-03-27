import React from "react";
import { TextInput, TextInputProps, TouchableOpacity, View } from "react-native";
import styled from "styled-components/native";
import { LucideIcon } from "../lucide-icon";
import { useMobileTheme } from "@nks/mobile-theme";

interface SearchInputProps extends Omit<TextInputProps, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

export function SearchInput(props: SearchInputProps) {
  const { value, onChange, placeholder = "Search...", ...rest } = props;
  const { theme } = useMobileTheme();

  return (
    <InputWrapper>
      <StyledInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.color?.default?.borderActive}
        autoCapitalize="none"
        {...rest}
      />

      {!value && (
        <SearchIcon>
          <LucideIcon name="Search" size={19} color={theme.colorTextQuaternary || "#00000040"} />
        </SearchIcon>
      )}

      {!!value && (
        <ClearButton onPress={() => onChange?.("")} hitSlop={10}>
          <LucideIcon name="X" size={18} color={theme.colorTextQuaternary || "#00000040"} />
        </ClearButton>
      )}
    </InputWrapper>
  );
}

/* ---------------- Styled Components ---------------- */

const InputWrapper = styled.View(({ theme }) => ({
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: theme.colorBgContainer || "#ffffff",
  borderRadius: theme.borderRadius?.regular ?? 8,
  borderWidth: 1,
  borderColor: theme.colorBorder || "#d9d9d9",
  paddingLeft: 2,
  paddingRight: 10,
  height: 40,
  flexGrow: 1,
}));

const StyledInput = styled(TextInput)(({ theme }) => ({
  flex: 1,
  fontSize: 14,
  color: theme.colorText || "#000000e0",
  backgroundColor: "transparent",
  paddingVertical: 0,
  marginLeft: 10,
}));

const ClearButton = styled(TouchableOpacity)({
  marginLeft: 8,
});

const SearchIcon = styled(View)({
  justifyContent: "center",
  alignItems: "center",
});

export default SearchInput;
