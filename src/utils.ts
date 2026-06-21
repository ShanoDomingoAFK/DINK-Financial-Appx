/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Budget, CreditCard, GlobalState, ReceivedIncome, Expense, Amortization, FundTransfer, Recipe } from './types';

export const CATEGORIES = [
  { v: 'food', l: 'Food & Groceries', i: '🛒' },
  { v: 'dining', l: 'Dining Out', i: '🍽️' },
  { v: 'transport', l: 'Transport / Fuel', i: '🚗' },
  { v: 'utilities', l: 'Utilities', i: '💡' },
  { v: 'rent', l: 'Rent / Housing', i: '🏠' },
  { v: 'health', l: 'Health & Wellness', i: '🏥' },
  { v: 'fitness', l: 'Gym & Fitness', i: '💪' },
  { v: 'travel', l: 'Travel & Vacations', i: '✈️' },
  { v: 'entertainment', l: 'Entertainment', i: '🎬' },
  { v: 'shopping', l: 'Shopping', i: '🛍️' },
  { v: 'date', l: 'Date Nights', i: '🌙' },
  { v: 'home', l: 'Home Improvement', i: '🔧' },
  { v: 'savings', l: 'Savings / Investment', i: '🏦' },
  { v: 'load', l: 'Mobile / Internet', i: '📱' },
  { v: 'pets', l: 'Pets', i: '🐾' },
  { v: 'other', l: 'Other', i: '📌' },
  { v: 'amortization', l: 'Amortization', i: '🧾' },
  { v: 'card_payment', l: 'Credit Card Settlement', i: '💳' }
];

export const CATEGORY_COLORS: { [key: string]: string } = {
  food: '#0D9E80',
  dining: '#D94F4F',
  transport: '#4F54D4',
  utilities: '#38BDF8',
  rent: '#818CF8',
  health: '#4ADE80',
  fitness: '#34D399',
  travel: '#60A5FA',
  entertainment: '#F472B6',
  shopping: '#FB923C',
  date: '#E879F9',
  home: '#A16207',
  savings: '#2DD4BF',
  load: '#94A3B8',
  pets: '#FDBA74',
  other: '#6B7280',
  amortization: '#C97A0A',
  card_payment: '#0D9E80',
  fund_transfer: '#4F54D4'
};

export const CASH_COLORS = [
  '#0D9E80', '#4F54D4', '#C97A0A', '#D94F4F', '#E879F9', '#38BDF8', '#34D399', '#FB923C', '#6B7280'
];

export function getCategoryInfo(v: string) {
  return CATEGORIES.find(c => c.v === v) || { v, l: v, i: '📌' };
}

export function parseMoney(value: string | number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const isParenNegative = /^\(.*\)$/.test(raw);
  const cleaned = raw
    .replace(/[₱,\s]/g, '')
    .replace(/−/g, '-')
    .replace(/[()]/g, '')
    .replace(/[^0-9.\-]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return isParenNegative ? -Math.abs(n) : n;
}

export function formatPeso(value: string | number, decimals: number = 2): string {
  const num = parseMoney(value);
  const formatted = Math.abs(num).toLocaleString('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return '₱ ' + formatted;
}

export function formatAsYouTypeHTML(value: string): string {
  // Strip all except digits and single dot
  let clean = value.replace(/[^\d.]/g, '');
  const parts = clean.split('.');
  if (parts.length > 2) {
    clean = parts[0] + '.' + parts.slice(1).join('');
  }
  if (!clean) return '';
  if (clean === '.') return '₱ .';
  
  let integerPart = parts[0];
  const decimalPart = parts[1];
  
  if (integerPart) {
    if (integerPart.length > 1 && integerPart.startsWith('0')) {
      integerPart = integerPart.replace(/^0+/, '') || '0';
    }
    const intVal = parseInt(integerPart, 10);
    if (!isNaN(intVal)) {
      const formattedInt = intVal.toLocaleString('en-US');
      if (parts.length > 1) {
        return `₱ ${formattedInt}.${decimalPart}`;
      }
      return `₱ ${formattedInt}`;
    }
  } else {
    if (parts.length > 1) {
      return `₱ .${decimalPart}`;
    }
  }
  return '₱ ' + clean;
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function getMonthKey(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }
  return '';
}

export function formatMonth(key: string): string {
  if (!key || key === 'all') return 'All months';
  const parts = key.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(y) || isNaN(m)) return key;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
}

export function toDateObject(value: string | Date): Date | null {
  if (value instanceof Date) return value;
  if (!value) return null;
  const parts = value.split('-');
  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d);
    }
  }
  // Try MM/DD/YYYY
  const slashParts = value.split('/');
  if (slashParts.length === 3) {
    const m = Number(slashParts[0]);
    const d = Number(slashParts[1]);
    const y = Number(slashParts[2]);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d);
    }
  }
  const test = new Date(value);
  return isNaN(test.getTime()) ? null : test;
}

export function formatDisplayDate(value: string): string {
  const d = toDateObject(value);
  if (!d) return value;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

export function formatISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getCardDueInfo(dueDay: number) {
  const now = new Date();
  const normalizedDay = Math.min(Math.max(dueDay || 25, 1), 31);
  const due = new Date(now.getFullYear(), now.getMonth(), normalizedDay);
  if (due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    due.setMonth(due.getMonth() + 1);
  }
  const diffTime = due.getTime() - new Date().setHours(0,0,0,0);
  const days = Math.ceil(diffTime / 86400000);
  const dateLabel = formatDisplayDate(formatISODate(due));
  return {
    days,
    dateLabel,
    date: due,
    label: days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`
  };
}

export function clampStatementDate(year: number, monthIndex: number, day: number): Date {
  const normalizedDay = Math.min(Math.max(day || 25, 1), 31);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(normalizedDay, lastDay));
}

export function addDays(date: Date, days: number): Date {
  const clone = new Date(date.getTime());
  clone.setDate(clone.getDate() + days);
  return clone;
}

export function addMonths(date: Date, months: number): Date {
  const clone = new Date(date.getFullYear(), date.getMonth(), 1);
  clone.setMonth(clone.getMonth() + months);
  return clone;
}

export function getDueDateForStatement(card: CreditCard, statementDate: Date): Date {
  let due = clampStatementDate(statementDate.getFullYear(), statementDate.getMonth(), card.dueDay);
  if (due <= statementDate) {
    due = clampStatementDate(statementDate.getFullYear(), statementDate.getMonth() + 1, card.dueDay);
  }
  return due;
}

export interface StatementCycle {
  key: string;
  cycleStart: Date;
  statementDate: Date;
  dueDate: Date;
  daysToDue: number;
  status: string;
  cycleLabel: string;
  statementLabel: string;
  dueLabel: string;
}

export function getStatementCycleForDate(card: CreditCard, dateStr: string): StatementCycle {
  const dObj = toDateObject(dateStr) || new Date();
  let statementDate = clampStatementDate(dObj.getFullYear(), dObj.getMonth(), card.cutDay);
  if (dObj > statementDate) {
    statementDate = clampStatementDate(dObj.getFullYear(), dObj.getMonth() + 1, card.cutDay);
  }
  const previousStatementDate = clampStatementDate(statementDate.getFullYear(), statementDate.getMonth() - 1, card.cutDay);
  const cycleStart = addDays(previousStatementDate, 1);
  const dueDate = getDueDateForStatement(card, statementDate);
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysToDue = Math.ceil((dueDate.getTime() - todayDate.getTime()) / 86400000);
  
  let status = 'Open statement cycle';
  if (todayDate > dueDate) {
    status = 'Past due based on due date';
  } else if (todayDate > statementDate) {
    status = daysToDue === 0 ? 'Due today' : `Closed statement · due in ${daysToDue} day${daysToDue === 1 ? '' : 's'}`;
  }

  return {
    key: formatISODate(statementDate),
    cycleStart,
    statementDate,
    dueDate,
    daysToDue,
    status,
    cycleLabel: `${formatDisplayDate(formatISODate(cycleStart))} – ${formatDisplayDate(formatISODate(statementDate))}`,
    statementLabel: formatDisplayDate(formatISODate(statementDate)),
    dueLabel: formatDisplayDate(formatISODate(dueDate))
  };
}

export function getCardLastStatementDue(card: CreditCard, state: GlobalState): number {
  const baseStatement = card.statementBalance || 0;
  
  const totalPayments = state.expenses
    .filter(e => e.type === 'card_payment' && e.cardPaymentCardId === card.id)
    .reduce((sum, e) => sum + e.amount, 0);

  const cardExpenses = state.expenses.filter(e => e.paymentSourceType === 'card' && e.paymentSourceId === card.id && e.type !== 'card_payment');
  
  const recurring = state.amortizations
    .filter(a => a.recurringCardId === card.id)
    .map(a => ({
      desc: `${a.name} Recur Charge`,
      amount: a.monthlyAmount,
      date: today().substring(0, 8) + '15',
      paymentSourceType: 'card' as 'card',
      paymentSourceId: card.id,
    }));
    
  const allExpenses = [...cardExpenses, ...recurring];
  
  const groups: { [key: string]: { statementDate: Date; total: number } } = {};
  allExpenses.forEach(row => {
    const cycle = getStatementCycleForDate(card, row.date);
    const gKey = cycle.key;
    if (!groups[gKey]) {
      groups[gKey] = {
        statementDate: cycle.statementDate,
        total: 0
      };
    }
    groups[gKey].total += row.amount;
  });
  
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const closedGroups = Object.values(groups)
    .filter(g => todayDate >= g.statementDate)
    .sort((a,b) => b.statementDate.getTime() - a.statementDate.getTime());
  
  if (closedGroups.length > 0) {
    const mostRecentClosedTotal = closedGroups[0].total;
    const cutoffDateStr = formatISODate(closedGroups[0].statementDate);
    
    const paymentsAfterStatementCutoff = state.expenses
      .filter(e => e.type === 'card_payment' && e.cardPaymentCardId === card.id && e.date >= cutoffDateStr)
      .reduce((sum, e) => sum + e.amount, 0);
      
    // Combine base credit card statement balance with dynamic closed statement total if there are dynamic logs
    // But since they might overlap or represent different times (base starting balance represents prior statements that are already closed),
    // let's say the absolute last statement is indeed the dynamic closed one (if it has dynamic transactions),
    // otherwise the base statement balance (and subtract payments).
    if (mostRecentClosedTotal > 0) {
      return Math.max(0, mostRecentClosedTotal - paymentsAfterStatementCutoff);
    }
  }
  
  return Math.max(0, baseStatement - totalPayments);
}

export function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

export function getAmortizationStatus(item: Amortization, refDate: Date = new Date()) {
  const termMonths = Math.max(1, item.termMonths || 1);
  const monthlyAmount = item.monthlyAmount;
  const start = toDateObject(item.startDate) || new Date();
  const finish = addMonths(start, termMonths - 1);
  const currentMonthNo = monthIndex(refDate) - monthIndex(start) + 1;
  const active = currentMonthNo >= 1 && currentMonthNo <= termMonths;
  const beforeStart = currentMonthNo < 1;
  const completed = currentMonthNo > termMonths;
  const displayMonth = beforeStart ? 0 : Math.min(currentMonthNo, termMonths);
  const remainingMonths = beforeStart ? termMonths : Math.max(0, termMonths - displayMonth);
  return {
    termMonths,
    monthlyAmount,
    start,
    finish,
    active,
    completed,
    currentMonthNo: displayMonth,
    remainingMonths,
    finishLabel: formatDisplayDate(formatISODate(finish)),
    statusLabel: completed ? 'Finished' : (beforeStart ? 'Not started' : `Month ${displayMonth} of ${termMonths}`)
  };
}

export const INITIAL_STATE: GlobalState = {
  partnerNames: { you: 'Aiden', partner: 'Chloe' },
  salaries: { you: 65000, partner: 52000 },
  deductions: {
    you: { sss: 1300, phic: 1100, hdmf: 200, tax: 4500 },
    partner: { sss: 1100, phic: 900, hdmf: 200, tax: 3100 }
  },
  incomeSources: [
    { id: 's1', desc: 'Freelance Architectural Blueprint Design', expectedAmt: 12000, earner: 'you' },
    { id: 's2', desc: 'Online Yoga Instruction Portfolio', expectedAmt: 8000, earner: 'partner' }
  ],
  receivedIncome: [
    { id: 'i1', desc: 'Primary Salary Aiden', amount: 65000, date: today().substring(0, 8) + '01', type: 'salary', earner: 'You', via: 'BPI Payroll', paymentSourceType: 'cash', paymentSourceId: 'ca_bank_1' },
    { id: 'i2', desc: 'Primary Salary Chloe', amount: 52000, date: today().substring(0, 8) + '01', type: 'salary', earner: 'Partner', via: 'Security Bank Office', paymentSourceType: 'cash', paymentSourceId: 'ca_bank_2' }
  ],
  expenses: [
    { id: 'e1', desc: 'Landers Wholesale Club Groceries', amount: 4850, date: today().substring(0, 8) + '02', cat: 'food', via: 'BPI Amore Card', paymentSourceType: 'card', paymentSourceId: 'cc1', earner: 'Joint' },
    { id: 'e2', desc: 'Meralco Power Digital', amount: 5200, date: today().substring(0, 8) + '03', cat: 'utilities', via: 'GCash Outlet', paymentSourceType: 'cash', paymentSourceId: 'ca_gcash', earner: 'Joint' },
    { id: 'e3', desc: 'Ruth Chris Date Night Dinner', amount: 4200, date: today().substring(0, 8) + '05', cat: 'date', via: 'BDO Gold Visa', paymentSourceType: 'card', paymentSourceId: 'cc2', earner: 'Joint' },
    { id: 'e4', desc: 'Annual Pet Vet Immunizations', amount: 2800, date: today().substring(0, 8) + '07', cat: 'pets', via: 'GCash Outlet', paymentSourceType: 'cash', paymentSourceId: 'ca_gcash', earner: 'Joint' }
  ],
  cards: [
    { id: 'cc1', name: 'BPI Amore Cashback', bank: 'BPI Bank', limit: 80000, statementBalance: 4850, outstandingBalance: 4850, cutDay: 28, dueDay: 22, color: '#D94F4F' },
    { id: 'cc2', name: 'BDO Gold Visa', bank: 'Banco De Oro', limit: 120000, statementBalance: 4200, outstandingBalance: 4200, cutDay: 5, dueDay: 25, color: '#C97A0A' }
  ],
  budgets: [
    { id: 'bg1', cat: 'food', label: 'Food & Groceries', icon: '🛒', limit: 15000 },
    { id: 'bg2', cat: 'utilities', label: 'Utilities', icon: '💡', limit: 10000 },
    { id: 'bg3', cat: 'date', label: 'Date Nights', icon: '🌙', limit: 8000 },
    { id: 'bg4', cat: 'pets', label: 'Pets', icon: '🐾', limit: 5000 },
    { id: 'bg5', cat: 'amortization', label: 'Amortization', icon: '🧾', limit: 25000 },
    { id: 'bg6', cat: 'savings', label: 'Savings & Investments', icon: '🏦', limit: 30000 }
  ],
  monthlyBudgets: {},
  amortizations: [
    { id: 'am1', name: 'Mazda 3 Car Loan Amortization', cat: 'transport', monthlyAmount: 18500, startDate: '2025-01-15', termMonths: 60, recurringCardId: '' },
    { id: 'am2', name: 'Premium Gym Couple Membership', cat: 'fitness', monthlyAmount: 4800, startDate: '2026-01-01', termMonths: 12, recurringCardId: 'cc1' }
  ],
  transfers: [
    { id: 't1', type: 'fund_transfer', desc: 'Funding emergency GCash reserve', amount: 3000, date: today().substring(0, 8) + '04', fromCashAccountId: 'ca_bank_1', toCashAccountId: 'ca_gcash' }
  ],
  cashAccounts: [
    { id: 'ca_bank_1', name: 'BPI Payroll Account', color: '#D94F4F' },
    { id: 'ca_bank_2', name: 'Security Bank Checking', color: '#0066FF' },
    { id: 'ca_gcash', name: 'GCash Digits Wallet', color: '#4F54D4' }
  ],
  settings: {
    monthlySavingsTarget: 35000,
    cashOnHand: 0
  }
};

export const DEFAULT_RECIPES: Recipe[] = [
  {
    id: 'rec_adobo',
    name: 'Adobong Baboy (Pork Adobo)',
    emoji: '🍛',
    description: 'Savory stewed pork belly tenderly simmered in vinegar, soy sauce, garlic, and bay leaves.',
    isSelected: true,
    ingredients: [
      { name: 'Pork Belly (Liempo)', amount: 500, unit: 'g', category: 'meat' },
      { name: 'Garlic', amount: 6, unit: 'cloves', category: 'condiments' },
      { name: 'Soy Sauce', amount: 60, unit: 'ml', category: 'condiments' },
      { name: 'Vinegar', amount: 40, unit: 'ml', category: 'condiments' },
      { name: 'Whole Peppercorns', amount: 10, unit: 'pcs', category: 'condiments' },
      { name: 'Bay Leaves', amount: 3, unit: 'pcs', category: 'condiments' }
    ]
  },
  {
    id: 'rec_sinigang',
    name: 'Sinigang na Baboy (Pork Sinigang)',
    emoji: '🍲',
    description: 'Classic Philippine sour soup with tender pork cuts, fresh taro, and local market vegetables.',
    isSelected: false,
    ingredients: [
      { name: 'Pork Ribs / Pork Belly', amount: 500, unit: 'g', category: 'meat' },
      { name: 'Sinigang Mix Powder', amount: 1, unit: 'pack', category: 'condiments' },
      { name: 'Tomato', amount: 2, unit: 'pcs', category: 'vegetables' },
      { name: 'Radish (Labanos)', amount: 1, unit: 'pc', category: 'vegetables' },
      { name: 'Kangkong (Water Spinach)', amount: 1, unit: 'bunch', category: 'vegetables' },
      { name: 'Gabi (Taro Root)', amount: 2, unit: 'pcs', category: 'vegetables' },
      { name: 'Green Long Chili (Sili)', amount: 2, unit: 'pcs', category: 'vegetables' },
      { name: 'Onion', amount: 1, unit: 'pc', category: 'condiments' }
    ]
  },
  {
    id: 'rec_tinola',
    name: 'Tinolang Manok (Chicken Tinola)',
    emoji: '🍗',
    description: 'Comforting, gingery bone-in chicken soup served with chili leaves and green papaya slice.',
    isSelected: false,
    ingredients: [
      { name: 'Chicken Cutlets', amount: 605, unit: 'g', category: 'poultry' },
      { name: 'Green Papaya / Sayote', amount: 1, unit: 'pc', category: 'vegetables' },
      { name: 'Ginger root', amount: 1, unit: 'pc', category: 'condiments' },
      { name: 'Garlic', amount: 4, unit: 'cloves', category: 'condiments' },
      { name: 'Onion', amount: 1, unit: 'pc', category: 'condiments' },
      { name: 'Malunggay or Sili Leaves', amount: 1, unit: 'bunch', category: 'vegetables' }
    ]
  },
  {
    id: 'rec_hipon',
    name: 'Sinigang na Hipon (Shrimp Sinigang)',
    emoji: '🦐',
    description: 'Light and sour seafood soup loaded with juicy prawns, long beans, and handpicked leafy greens.',
    isSelected: false,
    ingredients: [
      { name: 'Fresh Shrimps (Hipon)', amount: 400, unit: 'g', category: 'seafood' },
      { name: 'Sinigang Mix Powder', amount: 1, unit: 'pack', category: 'condiments' },
      { name: 'Radish (Labanos)', amount: 1, unit: 'pc', category: 'vegetables' },
      { name: 'String Beans (Sitaw)', amount: 1, unit: 'bunch', category: 'vegetables' },
      { name: 'Kangkong (Water Spinach)', amount: 1, unit: 'bunch', category: 'vegetables' },
      { name: 'Tomato', amount: 2, unit: 'pcs', category: 'vegetables' },
      { name: 'Onion', amount: 1, unit: 'pc', category: 'condiments' }
    ]
  },
  {
    id: 'rec_pinakbet',
    name: 'Pinakbet (Filipino Vegetable Stew)',
    emoji: '🍆',
    description: 'Indigenous steamed local gourds, eggplant, sitaw, and ladyfingers seasoned with crispy pork belly and rich shrimp paste.',
    isSelected: false,
    ingredients: [
      { name: 'Pork Belly (Liempo)', amount: 150, unit: 'g', category: 'meat' },
      { name: 'Squash (Kalabasa)', amount: 250, unit: 'g', category: 'vegetables' },
      { name: 'Eggplant (Talong)', amount: 2, unit: 'pcs', category: 'vegetables' },
      { name: 'String Beans (Sitaw)', amount: 1, unit: 'bunch', category: 'vegetables' },
      { name: 'Okra (Lady Fingers)', amount: 6, unit: 'pcs', category: 'vegetables' },
      { name: 'Bitter Melon (Ampalaya)', amount: 1, unit: 'pc', category: 'vegetables' },
      { name: 'Shrimp Paste (Bagoong Alamang)', amount: 2, unit: 'tbsp', category: 'condiments' }
    ]
  },
  {
    id: 'rec_monggo',
    name: 'Ginisang Monggo (Sautéed Mung Beans)',
    emoji: '🍲',
    description: 'Savory mung bean broth cooked with baby shrimp or sliced pork, finished with spinach and crushed garlic pork rinds.',
    isSelected: false,
    ingredients: [
      { name: 'Dry Green Mung Beans (Monggo)', amount: 200, unit: 'g', category: 'others' },
      { name: 'Fresh Shrimps or Pork Cuts', amount: 150, unit: 'g', category: 'meat' },
      { name: 'Garlic', amount: 4, unit: 'cloves', category: 'condiments' },
      { name: 'Onion', amount: 1, unit: 'pc', category: 'condiments' },
      { name: 'Tomato', amount: 1, unit: 'pc', category: 'vegetables' },
      { name: 'Spinach or Malunggay Leaves', amount: 1, unit: 'bunch', category: 'vegetables' },
      { name: 'Pork Chicharon (Crushed)', amount: 50, unit: 'g', category: 'others' }
    ]
  }
];

