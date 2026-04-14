import { KeyboardAvoidingView } from "react-native";
import styled from "styled-components/native";
import { Column, Row, Typography } from "@nks/mobile-ui-components";

// ─── Shared Constants ──────────────────────────────────────────────────────────

export const CARD_SHADOW = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.08,
  shadowRadius: 20,
  elevation: 8,
} as const;

// ─── Layout ────────────────────────────────────────────────────────────────────

export const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgContainer};
`;

export const KeyboardAvoiding = styled(KeyboardAvoidingView)`
  flex: 1;
`;

export const PageScroll = styled.ScrollView`
  flex: 1;
`;

// ─── Hero / Branding ───────────────────────────────────────────────────────────

export const BrandHero = styled.View<{ $topInset: number }>`
  background-color: ${({ theme }) => theme.colorPrimary};
  padding-top: ${({ $topInset, theme }) => $topInset + theme.sizing.large}px;
  padding-left: ${({ theme }) => theme.sizing.xLarge}px;
  padding-right: ${({ theme }) => theme.sizing.xLarge}px;
  padding-bottom: ${({ theme }) => theme.sizing.xLarge * 2 + 8}px;
  overflow: hidden;
  justify-content: space-between;
  min-height: 220px;
`;

export const DecoRing1 = styled.View`
  position: absolute;
  width: 220px;
  height: 220px;
  border-radius: 110px;
  border-width: 1.5px;
  border-color: ${({ theme }) => theme.colorWhite};
  opacity: 0.1;
  top: -70px;
  right: -50px;
`;

export const DecoRing2 = styled.View`
  position: absolute;
  width: 130px;
  height: 130px;
  border-radius: 65px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorWhite};
  opacity: 0.07;
  bottom: 40px;
  left: -20px;
`;

export const DecoRing3 = styled.View`
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 150px;
  background-color: ${({ theme }) => theme.colorWhite};
  opacity: 0.03;
  top: -100px;
  left: -100px;
`;

export const DecoRing4 = styled.View`
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 90px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorWhite};
  opacity: 0.05;
  bottom: -40px;
  right: 20px;
`;

export const BrandMark = styled.View`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.regular}px;
  background-color: ${({ theme }) => theme.colorWhite};
  align-items: center;
  justify-content: center;
`;

export const HeroText = styled(Column)`
  margin-top: ${({ theme }) => theme.sizing.xLarge}px;
`;

// ─── Form Card ─────────────────────────────────────────────────────────────────

export const FormCard = styled(Column)<{ $bottomInset: number }>`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-top-left-radius: ${({ theme }) => theme.borderRadius.xxLarge}px;
  border-top-right-radius: ${({ theme }) => theme.borderRadius.xxLarge}px;
  padding-left: ${({ theme }) => theme.sizing.xLarge}px;
  padding-right: ${({ theme }) => theme.sizing.xLarge}px;
  padding-top: ${({ theme }) => theme.sizing.xLarge}px;
  padding-bottom: ${({ theme, $bottomInset }) =>
    theme.sizing.medium + $bottomInset}px;
  margin-top: -${({ theme }) => theme.borderRadius.xxLarge}px;
  flex: 1;
  justify-content: space-between;
`;

export const FormContent = styled(Column)``;

// ─── Error Display ─────────────────────────────────────────────────────────────

export const ErrorBanner = styled(Row)`
  background-color: ${({ theme }) => theme.colorErrorBg};
  border-radius: ${({ theme }) => theme.borderRadius.regular}px;
  padding-left: ${({ theme }) => theme.sizing.small}px;
  padding-right: ${({ theme }) => theme.sizing.small}px;
  padding-top: ${({ theme }) => theme.sizing.xSmall}px;
  padding-bottom: ${({ theme }) => theme.sizing.xSmall}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorErrorBorder};
`;

export const ErrorText = styled(Typography.Caption)`
  color: ${({ theme }) => theme.colorErrorText};
  flex: 1;
`;
