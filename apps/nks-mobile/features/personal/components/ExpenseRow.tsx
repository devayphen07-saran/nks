import React from "react";
import { Row, Column, Typography, LucideIcon } from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import styled from "styled-components/native";

export interface ExpenseItem {
  id: number;
  title: string;
  amount: string;
  category: string;
  date: string;
}

interface ExpenseRowProps {
  item: ExpenseItem;
  isLast?: boolean;
}

export function ExpenseRow({ item, isLast = false }: ExpenseRowProps) {
  const { theme } = useMobileTheme();
  const isExpense = item.amount.startsWith("-");

  return (
    <RowContainer
      align="center"
      justify="space-between"
      style={{
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colorBorderSecondary,
      }}
    >
      <Row align="center" gap="medium">
        <IconBox>
          <LucideIcon
            name={isExpense ? "ArrowDownRight" : "ArrowUpRight"}
            size={18}
            color={isExpense ? theme.colorError : theme.colorSuccess}
          />
        </IconBox>
        <Column>
          <Typography.Body weight="semiBold">{item.title}</Typography.Body>
          <Typography.Caption type="secondary">
            {item.category} • {item.date}
          </Typography.Caption>
        </Column>
      </Row>
      <Typography.Body
        weight="bold"
        color={isExpense ? theme.colorText : theme.colorSuccess}
      >
        {item.amount}
      </Typography.Body>
    </RowContainer>
  );
}

const RowContainer = styled(Row)`
  padding: ${({ theme }) => theme.sizing.large}px;
`;

const IconBox = styled.View`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${({ theme }) => theme.colorBgLayout};
  align-items: center;
  justify-content: center;
`;
