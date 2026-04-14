import styled from "styled-components/native";

export const FormCard = styled.View`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
  padding: ${({ theme }) => theme.sizing.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.medium}px;
`;
