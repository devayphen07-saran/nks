/**
 * Shared mock data for personal workspace screens.
 * Replace with real API calls when the personal finance feature is built.
 */

import type { ExpenseItem } from "./components/ExpenseRow";

export const RECENT_EXPENSE_ITEMS: ExpenseItem[] = [
  { id: 1, title: "Grocery Store", amount: "-₹1,250", category: "Food", date: "Today" },
  { id: 2, title: "Gas Station", amount: "-₹3,500", category: "Travel", date: "Yesterday" },
  { id: 3, title: "Subscription", amount: "-₹499", category: "Entertainment", date: "Mar 22" },
  { id: 4, title: "Salary Deposit", amount: "+₹45,000", category: "Income", date: "Mar 20" },
];

export interface MockExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
}

export const MOCK_EXPENSES: MockExpense[] = [
  { id: "1", category: "Food", amount: 450, date: "2024-03-20", description: "Lunch at restaurant" },
  { id: "2", category: "Transport", amount: 150, date: "2024-03-19", description: "Taxi fare" },
  { id: "3", category: "Shopping", amount: 2500, date: "2024-03-18", description: "Grocery shopping" },
  { id: "4", category: "Entertainment", amount: 800, date: "2024-03-17", description: "Movie tickets" },
];

export const CATEGORY_ICONS: Record<string, string> = {
  Food: "Utensils",
  Transport: "Car",
  Shopping: "ShoppingBag",
  Entertainment: "Music",
};
