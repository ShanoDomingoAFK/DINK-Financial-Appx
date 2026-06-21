/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CashAccount {
  id: string;
  name: string;
  color: string;
}

export interface CreditCard {
  id: string;
  name: string;
  bank: string;
  limit: number;
  statementBalance: number;
  outstandingBalance: number;
  cutDay: number;
  dueDay: number;
  color: string;
}

export interface IncomeStream {
  id: string;
  desc: string;
  expectedAmt: number;
  earner: 'you' | 'partner';
}

export interface ReceivedIncome {
  id: string;
  desc: string;
  amount: number;
  date: string; // ISO date YYYY-MM-DD
  via: string; // Display string, e.g. "GCash"
  paymentSourceType: 'cash' | 'card' | 'manual';
  paymentSourceId: string;
  earner: string; // "You", "Partner", "Joint"
  type: string; // "salary" | "additional"
}

export interface Expense {
  id: string;
  desc: string;
  amount: number;
  date: string; // YYYY-MM-DD
  cat: string; // Category, e.g. "food", "amortization"
  via: string;
  paymentSourceType: 'cash' | 'card' | 'manual';
  paymentSourceId: string;
  earner: string; // "You", "Partner", "Joint"
  type?: string; // "card_payment" for credit card settlements
  cardPaymentCardId?: string; // Card references if settlement
  isVirtualCardCharge?: boolean; // Amortization auto-charges
  amortizationId?: string;
  recurringMonth?: string;
}

export interface Budget {
  id: string;
  cat: string;
  label: string;
  icon: string;
  limit: number;
}

export interface Amortization {
  id: string;
  name: string;
  cat: string;
  monthlyAmount: number;
  startDate: string; // YYYY-MM-DD
  termMonths: number;
  recurringCardId: string; // CreditCard id or ""
}

export interface FundTransfer {
  id: string;
  type: 'fund_transfer';
  desc: string;
  amount: number;
  date: string; // YYYY-MM-DD
  fromCashAccountId: string;
  toCashAccountId: string;
}

export interface PartnerDeductions {
  sss: number;
  phic: number;
  hdmf: number;
  tax: number;
}

export interface PartnerNames {
  you: string;
  partner: string;
  youPic?: string; // Avatar URL or preset id
  partnerPic?: string; // Avatar URL or preset id
}

export interface Salaries {
  you: number;
  partner: number;
}

export interface MonthlyBudgets {
  [monthKey: string]: {
    [budgetIdOrCat: string]: number;
  };
}

export interface Settings {
  monthlySavingsTarget: number;
  cashOnHand: number;
}

export interface Ingredient {
  name: string; // e.g. "Pork Belly", "Red Onion", "Vinegar"
  amount: number; // numerical quantity
  unit: string; // "g", "pcs", "ml", "cloves", "can", etc.
  category: 'meat' | 'poultry' | 'seafood' | 'vegetables' | 'condiments' | 'others';
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  description: string;
  ingredients: Ingredient[];
  isSelected: boolean;
}

export interface GlobalState {
  partnerNames: PartnerNames;
  salaries: Salaries;
  deductions: {
    you: PartnerDeductions;
    partner: PartnerDeductions;
  };
  incomeSources: IncomeStream[];
  receivedIncome: ReceivedIncome[];
  expenses: Expense[];
  cards: CreditCard[];
  budgets: Budget[];
  monthlyBudgets: MonthlyBudgets;
  amortizations: Amortization[];
  transfers: FundTransfer[];
  cashAccounts: CashAccount[];
  settings: Settings;
  recipes?: Recipe[];
}
