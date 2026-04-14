/**
 * Shared styled components for list screens that include a search bar,
 * filter pills, and a loading card skeleton.
 *
 * Used by:
 *  - features/personal/PersonalDashboardScreen.tsx
 *  - features/store/StoreListScreen.tsx
 */

import styled from "styled-components/native";
import { Typography } from "@nks/mobile-ui-components";

export const HeaderControls = styled.View`
  background-color: ${({ theme }) => theme.colorBgContainer};
  padding: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.medium}px;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.colorBorderSecondary};
  gap: ${({ theme }) => theme.sizing.small}px;
  z-index: 10;
`;

export const SearchRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.sizing.small}px;
`;

export const FilterRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.sizing.xSmall}px;
`;

export const FilterButton = styled.TouchableOpacity<{ active: boolean }>`
  background-color: ${({ theme, active }) =>
    active ? theme.colorPrimary : theme.colorBgLayout};
  border-radius: 20px;
  padding: 6px 14px;
  border-width: 1px;
  border-color: ${({ theme, active }) =>
    active ? theme.colorPrimary : theme.colorBorderSecondary};
`;

export const FilterButtonText = styled(Typography.Caption)<{ active: boolean }>`
  color: ${({ active, theme }) =>
    active ? theme.colorWhite : theme.colorTextSecondary};
  font-weight: ${({ active }) => (active ? "700" : "500")};
`;

export const LoadingCard = styled.View`
  height: 80px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.small}px;
  align-items: center;
  justify-content: center;
`;

export const LoadingCardInset = styled.View`
  height: 80px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.small}px;
  align-items: center;
  justify-content: center;
  margin-left: ${({ theme }) => theme.sizing.large}px;
  margin-right: ${({ theme }) => theme.sizing.large}px;
`;
