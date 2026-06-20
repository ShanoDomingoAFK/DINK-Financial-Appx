/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  PiggyBank, 
  AlertCircle,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Plus,
  Trash2
} from 'lucide-react';
import { GlobalState, ReceivedIncome, Expense } from '../types';
import { 
  formatPeso, 
  getCategoryInfo, 
  CATEGORY_COLORS, 
  getMonthKey, 
  today, 
  formatMonth,
  getCardDueInfo,
  getAmortizationStatus,
  getAmortizationStatus as getAmortStatus
} from '../utils';
import { AVATAR_PRESETS } from './Login';

// Helper to render partner avatar elegantly
const renderOverviewAvatar = (pic?: string, name?: string, sizeClass: string = "w-10 h-10 text-md") => {
  const isUrl = pic && (pic.startsWith('http') || pic.startsWith('data:image'));
  if (isUrl) {
    return (
      <img 
        src={pic} 
        alt={name} 
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-full object-cover border-2 border-stone-300 shadow-md shrink-0`} 
      />
    );
  }
  const preset = AVATAR_PRESETS.find(p => p.id === pic);
  return (
    <div className={`rounded-full ${sizeClass} flex items-center justify-center font-bold text-white border-2 border-stone-300/40 shadow-inner bg-gradient-to-tr shrink-0 ${preset?.gradient || 'from-stone-400 to-stone-600'}`}>
      {preset ? preset.emoji : (name ? name.substring(0, 2).toUpperCase() : '👤')}
    </div>
  );
};

interface OverviewProps {
  state: GlobalState;
  onAdjustTarget: () => void;
  onAddCashAccount: () => void;
  onDeleteCashAccount: (id: string) => void;
}

export default function Overview({ state, onAdjustTarget, onAddCashAccount, onDeleteCashAccount }: OverviewProps) {
  const [detailModal, setDetailModal] = useState<string | null>(null);

  // 1. Calculations
  const currentMonthKey = getMonthKey(today());
  
  // Total Logged Income and Expenses
  const totalIncome = state.receivedIncome.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = state.expenses.reduce((sum, item) => sum + item.amount, 0);

  // Cash on hand computation (Matched Cash Accounts)
  // Formula: matched income less matched expenses plus transfers
  const getCashAccountActivity = (accountId: string) => {
    const incomeForAcc = state.receivedIncome
      .filter(i => i.paymentSourceType === 'cash' && i.paymentSourceId === accountId)
      .reduce((sum, i) => sum + i.amount, 0);

    const expensesForAcc = state.expenses
      .filter(e => e.paymentSourceType === 'cash' && e.paymentSourceId === accountId)
      .reduce((sum, e) => sum + e.amount, 0);

    const transfersIn = state.transfers
      .filter(t => t.toCashAccountId === accountId)
      .reduce((sum, t) => sum + t.amount, 0);

    const transfersOut = state.transfers
      .filter(t => t.fromCashAccountId === accountId)
      .reduce((sum, t) => sum + t.amount, 0);

    return incomeForAcc + transfersIn - expensesForAcc - transfersOut;
  };

  const cashOnHandTotal = state.cashAccounts.reduce((sum, acc) => sum + getCashAccountActivity(acc.id), 0);

  // Salary to Receive this month
  const receivedThisMonth = state.receivedIncome.filter(i => getMonthKey(i.date) === currentMonthKey);
  const salaryReceivedThisMonth = receivedThisMonth
    .filter(i => i.type === 'salary')
    .reduce((sum, i) => sum + i.amount, 0);

  // Deductions Total per partner
  const getDeductionTotal = (earner: 'you' | 'partner') => {
    const d = state.deductions[earner];
    return d.sss + d.phic + d.hdmf + d.tax;
  };

  const expectedSalaryNet = Math.max(0, 
    (state.salaries.you - getDeductionTotal('you')) + 
    (state.salaries.partner - getDeductionTotal('partner'))
  );
  const salaryToReceive = Math.max(0, expectedSalaryNet - salaryReceivedThisMonth);

  // Additional Income to Receive
  const additionalReceivedThisMonth = receivedThisMonth
    .filter(i => i.type !== 'salary')
    .reduce((sum, i) => sum + i.amount, 0);
  const expectedAdditionalIncome = state.incomeSources.reduce((sum, s) => sum + s.expectedAmt, 0);
  const additionalIncomeToReceive = Math.max(0, expectedAdditionalIncome - additionalReceivedThisMonth);

  // Spent by category in current month (excluding card settlements)
  const getSpentByCategory = (cat: string) => {
    return state.expenses
      .filter(e => getMonthKey(e.date) === currentMonthKey && e.cat === cat && e.type !== 'card_payment')
      .reduce((sum, e) => sum + e.amount, 0);
  };

  // Remaining budget caps
  const getBudgetLimitForMonth = (b: { id: string; cat: string; limit: number }) => {
    const monthMap = state.monthlyBudgets[currentMonthKey] || {};
    if (monthMap[b.id] !== undefined) return monthMap[b.id];
    if (monthMap[b.cat] !== undefined) return monthMap[b.cat];
    return b.limit;
  };

  // Amortization status and payments
  const getAmortizationPaymentTotal = (item: any) => {
    const manualAndDirectPaid = state.expenses
      .filter(e => e.cat === item.cat && getMonthKey(e.date) === currentMonthKey && e.type !== 'card_payment')
      .reduce((sum, e) => sum + e.amount, 0);
      
    // Count recurring card charge if active
    const status = getAmortStatus(item, new Date());
    const recurringPaid = item.recurringCardId && status.active ? item.monthlyAmount : 0;
    return manualAndDirectPaid + recurringPaid;
  };

  const amortizationBudgetTotals = () => {
    const due = state.amortizations.reduce((sum, item) => {
      const status = getAmortizationStatus(item, new Date());
      return sum + (status.active ? item.monthlyAmount : 0);
    }, 0);
    
    // Total paid to amortization categories
    const paid = state.amortizations.reduce((sum, item) => sum + getAmortizationPaymentTotal(item), 0);
    return { due, paid, remaining: Math.max(0, due - paid) };
  };

  const remainingBudgetTotal = state.budgets.reduce((sum, b) => {
    const spent = getSpentByCategory(b.cat);
    const limit = getBudgetLimitForMonth(b);
    return sum + Math.max(0, limit - spent);
  }, 0);

  // Credit card owed total
  // outstandingBalance + dynamic charges - settlements (recorded payments)
  const getCardOwedTotal = (cardId: string) => {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return 0;
    
    const manualOutstanding = card.outstandingBalance;
    const itemizedCharges = state.expenses
      .filter(e => e.paymentSourceType === 'card' && e.paymentSourceId === cardId && e.type !== 'card_payment')
      .reduce((sum, e) => sum + e.amount, 0);

    // Filter Amortization auto-charges if charging to card
    const recurringCharges = state.amortizations
      .filter(item => item.recurringCardId === cardId)
      .reduce((sum, item) => {
        const status = getAmortizationStatus(item, new Date());
        return sum + (status.active ? item.monthlyAmount : 0);
      }, 0);

    const totalSettled = state.expenses
      .filter(e => e.type === 'card_payment' && e.cardPaymentCardId === cardId)
      .reduce((sum, e) => sum + e.amount, 0);

    return Math.max(0, manualOutstanding + itemizedCharges + recurringCharges - totalSettled);
  };

  const creditCardTotalOwed = state.cards.reduce((sum, card) => sum + getCardOwedTotal(card.id), 0);

  // Total Headroom Formula!
  // Headroom = Cash on Hand + Salaries to Receive + Additional Income to Receive - Remaining Budgets - Credit Card Owed
  const netHouseholdHeadroom = cashOnHandTotal + salaryToReceive + additionalIncomeToReceive - remainingBudgetTotal - creditCardTotalOwed;

  // Expected Total Combined Net revenue
  const expectedMonthlyNetIncome = expectedSalaryNet + expectedAdditionalIncome;

  // Monthly savings metrics
  const cashFormulaTotal = cashOnHandTotal;
  const savingsTarget = state.settings.monthlySavingsTarget;
  const targetGap = savingsTarget - cashFormulaTotal;
  
  // Calculate Savings Rate (Cash on Hand divided by cash-routed income)
  const cashRoutedIncome = state.receivedIncome
    .filter(i => i.paymentSourceType === 'cash')
    .reduce((sum, i) => sum + i.amount, 0);
  const savingsRate = cashRoutedIncome > 0 ? Math.round((cashOnHandTotal / cashRoutedIncome) * 100) : 0;

  // Budget breaches
  const breachedBudgets = state.budgets.filter(b => {
    const spent = getSpentByCategory(b.cat);
    const limit = getBudgetLimitForMonth(b);
    return spent > limit;
  });

  // Top spends
  const categorySpends = state.budgets.map(b => ({
    ...b,
    spent: getSpentByCategory(b.cat)
  })).sort((a, b) => b.spent - a.spent);
  const topSpend = categorySpends[0]?.spent > 0 ? categorySpends[0] : null;

  // Generate exceptions / alerts
  const generateAlerts = () => {
    const list = [];
    if (netHouseholdHeadroom < 0) {
      list.push({
        id: 'headroom',
        icon: '🚨',
        title: 'Negative Headroom Exposure',
        body: `Formula headroom is negative by ${formatPeso(Math.abs(netHouseholdHeadroom))}. Review pending budgets or clear outstanding credit card dues.`,
        color: 'border-red-200 bg-red-50/50 text-red-900'
      });
    }
    if (cashOnHandTotal < 0) {
      list.push({
        id: 'cash',
        icon: '🚨',
        title: 'Overdrawn Liquid Cash',
        body: `Your net cash on hand is currently negative at ${formatPeso(cashOnHandTotal)}. Please verify accuracy of logged payments and income.`,
        color: 'border-red-200 bg-red-50/50 text-red-900'
      });
    }
    if (breachedBudgets.length > 0) {
      list.push({
        id: 'breach',
        icon: '⚠️',
        title: `${breachedBudgets.length} Budget Cap Breaches`,
        body: breachedBudgets.map(b => `${b.icon} ${b.label}`).join(' & ') + ' have crossed monthly targets.',
        color: 'border-amber-200 bg-amber-50/50 text-amber-950'
      });
    }
    if (targetGap > 0) {
      list.push({
        id: 'savings',
        icon: '🎯',
        title: 'Monthly Savings Shortfall',
        body: `You are currently ${formatPeso(targetGap)} below your savings target of ${formatPeso(savingsTarget)} for this month.`,
        color: 'border-indigo-100 bg-indigo-50/30 text-indigo-950'
      });
    }
    if (savingsRate >= 20) {
      list.push({
        id: 'healthy',
        icon: '✨',
        title: 'Healthy Savings Velocity',
        body: `Excellent! You are currently keeping ${savingsRate}% of cash income, exceeding the standard baseline parameter.`,
        color: 'border-emerald-100 bg-emerald-50/40 text-emerald-950'
      });
    }
    if (list.length === 0) {
      list.push({
        id: 'optimal',
        icon: '🟢',
        title: 'Ideal Financial Status',
        body: 'No budgetary breaches, revenue deficits, or target misalignments detected in your current models.',
        color: 'border-stone-200 bg-stone-50/80 text-stone-800'
      });
    }
    return list;
  };

  const alerts = generateAlerts();

  return (
    <div className="space-y-8">
      {/* Dynamic Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex relative shrink-0">
            {renderOverviewAvatar(state.partnerNames.youPic, state.partnerNames.you, "w-12 h-12 text-lg")}
            <div className="ml-[-16px] relative z-10">
              {renderOverviewAvatar(state.partnerNames.partnerPic, state.partnerNames.partner, "w-12 h-12 text-lg")}
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-stone-900 tracking-tight">
              Hi, {state.partnerNames.you} & {state.partnerNames.partner} 💑
            </h1>
            <p className="text-stone-500 font-medium text-xs sm:text-sm mt-0.5">
              DINK overall household ledger profile and liquid security buffer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs bg-stone-200/50 text-stone-700 px-3 py-1.5 rounded-full font-bold self-start md:self-auto font-display">
          <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full animate-pulse"></span>
          REAL-TIME ENGINE SYNCHRONIZED
        </div>
      </div>

      {/* Core Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-5 shadow-sm col-span-1 sm:col-span-2 lg:col-span-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 font-display">Expected Combined Net Yield</h3>
          <div className="text-2xl font-extrabold text-indigo-700 mt-3 font-display tracking-tight">
            {formatPeso(expectedMonthlyNetIncome)}
          </div>
          <p className="text-xs text-stone-400 font-semibold mt-2">
            Combined monthly net take-home (Base + Consulting)
          </p>
        </div>
      </div>

      {/* Headroom Overview */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 md:p-8 text-stone-100 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 tracking-wider uppercase font-display bg-emerald-900/30 px-3 py-1 rounded-full border border-emerald-500/20">
              💡 HOUSEHOLD FINANCIAL HEADROOM
            </div>
            <h2 className={`text-4xl md:text-5xl font-black font-display tracking-tight ${netHouseholdHeadroom >= 0 ? 'text-stone-50' : 'text-red-400'}`}>
              {formatPeso(netHouseholdHeadroom)}
            </h2>
            <p className="text-stone-400 font-medium text-xs md:text-sm max-w-2xl leading-relaxed">
              <strong>Your Core Cash Runway Buffer:</strong> This measures how much cash capacity you will retain at the end of the month by summing up your <span className="text-stone-200">Cash on Hand</span>, adding <span className="text-stone-200">expected incoming salaries/positions</span>, and subtracting <span className="text-stone-200">remaining budget caps</span> and <span className="text-stone-200">credit card owed totals</span>.
            </p>
          </div>
          <div className="flex-shrink-0 self-stretch lg:self-auto flex items-center justify-end">
            <span className={`text-xs font-bold tracking-wider px-4 py-2 rounded-2xl font-display ${
              netHouseholdHeadroom > 50000 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : netHouseholdHeadroom > 0 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {netHouseholdHeadroom > 50000 ? '✅ COMFORTABLE RUNWAY' : netHouseholdHeadroom > 0 ? '⚠️ VOLATILE HORIZON' : '🚨 CRITICAL DEFICIT'}
            </span>
          </div>
        </div>

        {/* Headroom Equation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-8 pt-6 border-t border-stone-800">
          <button 
            onClick={() => setDetailModal('cash')}
            className="bg-stone-900/50 hover:bg-stone-800/60 border border-stone-800/80 rounded-2xl p-4 text-left transition duration-150 group"
          >
            <div className="text-xs font-bold text-stone-500 font-display uppercase tracking-wider group-hover:text-stone-300 flex items-center gap-1">
              Cash on Hand <ArrowRight size={10} className="text-stone-600 group-hover:text-stone-400" />
            </div>
            <div className="text-lg font-extrabold text-emerald-400 mt-2 font-display">
              +{formatPeso(cashOnHandTotal)}
            </div>
            <div className="text-[10px] text-stone-500 font-semibold mt-1">
              Liquidity assets total
            </div>
          </button>

          <button 
            onClick={() => setDetailModal('salary')}
            className="bg-stone-900/50 hover:bg-stone-800/60 border border-stone-800/80 rounded-2xl p-4 text-left transition duration-150 group"
          >
            <div className="text-xs font-bold text-stone-500 font-display uppercase tracking-wider group-hover:text-stone-300 flex items-center gap-1">
              Unlogged Salary <ArrowRight size={10} className="text-stone-600 group-hover:text-stone-400" />
            </div>
            <div className="text-lg font-extrabold text-emerald-400 mt-2 font-display">
              +{formatPeso(salaryToReceive)}
            </div>
            <div className="text-[10px] text-stone-500 font-semibold mt-1">
              Outstanding base pay
            </div>
          </button>

          <button 
            onClick={() => setDetailModal('additional')}
            className="bg-stone-900/50 hover:bg-stone-800/60 border border-stone-800/80 rounded-2xl p-4 text-left transition duration-150 group"
          >
            <div className="text-xs font-bold text-stone-500 font-display uppercase tracking-wider group-hover:text-stone-300 flex items-center gap-1">
              Unlogged Consulting <ArrowRight size={10} className="text-stone-600 group-hover:text-stone-400" />
            </div>
            <div className="text-lg font-extrabold text-emerald-400 mt-2 font-display">
              +{formatPeso(additionalIncomeToReceive)}
            </div>
            <div className="text-[10px] text-stone-500 font-semibold mt-1">
              Secondary inbound streams
            </div>
          </button>

          <button 
            onClick={() => setDetailModal('budget')}
            className="bg-stone-900/50 hover:bg-stone-800/60 border border-stone-800/80 rounded-2xl p-4 text-left transition duration-150 group"
          >
            <div className="text-xs font-bold text-stone-500 font-display uppercase tracking-wider group-hover:text-stone-300 flex items-center gap-1">
              Remaining Budget <ArrowRight size={10} className="text-stone-600 group-hover:text-stone-400" />
            </div>
            <div className="text-lg font-extrabold text-red-400 mt-2 font-display">
              −{formatPeso(remainingBudgetTotal)}
            </div>
            <div className="text-[10px] text-stone-500 font-semibold mt-1">
              Unused allowable monthly caps
            </div>
          </button>

          <button 
            onClick={() => setDetailModal('credit')}
            className="bg-stone-900/50 hover:bg-stone-800/60 border border-stone-805/80 rounded-2xl p-4 text-col text-left transition duration-150 group col-span-2 md:col-span-1"
          >
            <div className="text-xs font-bold text-stone-500 font-display uppercase tracking-wider group-hover:text-stone-300 flex items-center gap-1">
              Credit Cards Owed <ArrowRight size={10} className="text-stone-600 group-hover:text-stone-400" />
            </div>
            <div className="text-lg font-extrabold text-red-400 mt-2 font-display">
              −{formatPeso(creditCardTotalOwed)}
            </div>
            <div className="text-[10px] text-stone-500 font-semibold mt-1">
              Dynamic card liability total
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Quick Metrics & Exception-alerts */}
        <div className="space-y-6 lg:col-span-2">
          {/* Trio Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 font-display">Current Savings Rate</span>
              <div className="text-2xl font-black text-stone-800 mt-1 font-display">{savingsRate}%</div>
              <div className="h-1.5 w-full bg-stone-200 mt-3 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${savingsRate >= 20 ? 'bg-emerald-600' : 'bg-amber-600'}`} style={{ width: `${Math.min(savingsRate, 100)}%` }}></div>
              </div>
              <p className="text-[10px] text-stone-500 mt-2 font-medium">Cash on hand as a percentage of cash income</p>
            </div>

            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 font-display">Top Expense Stream</span>
              <div className={`text-2xl font-black mt-1 font-display truncate ${topSpend ? 'text-stone-800' : 'text-stone-400'}`}>
                {topSpend ? topSpend.icon + ' ' + formatPeso(topSpend.spent, 0) : '—'}
              </div>
              <p className="text-[10px] text-stone-500 mt-5 font-semibold">
                {topSpend ? `Primary category: ${topSpend.label}` : 'No logged allocations yet'}
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 font-display">Monthly Savings Goal</span>
                <div className="text-2xl font-black text-stone-800 mt-1 font-display">{formatPeso(savingsTarget, 0)}</div>
              </div>
              <div className="flex justify-between items-center mt-3 pt-2 border-t border-stone-200/60">
                <span className="text-[10px] text-stone-500 font-bold uppercase">Status</span>
                <span className={`text-[10px] font-extrabold uppercase ${targetGap <= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {targetGap <= 0 ? '🎯 Target Achieved' : `${formatPeso(targetGap, 0)} Short`}
                </span>
              </div>
            </div>
          </div>

          {/* Alert Panel */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-stone-500 font-display">Smart Alert Engine</h3>
                <p className="text-xs text-stone-400 mt-0.5 font-semibold">Real-time indicators based on your currently logged data</p>
              </div>
              <button 
                onClick={onAdjustTarget}
                className="text-stone-600 hover:text-stone-800 text-xs font-bold border border-stone-300 rounded-lg px-2.5 py-1 transition bg-stone-50"
              >
                Adjust Target
              </button>
            </div>

            <div className="space-y-2 mt-4">
              {alerts.map((a, idx) => (
                <div key={idx} className={`p-4 border rounded-xl flex gap-3 items-start text-xs ${a.color}`}>
                  <span className="text-base leading-none">{a.icon}</span>
                  <div>
                    <h5 className="font-extrabold font-display leading-tight">{a.title}</h5>
                    <p className="mt-1 font-medium text-stone-600/95 leading-relaxed">{a.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Cash Accounts */}
        <div className="space-y-6">
          {/* Quick Cash-on-Hand Statement Formula */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 font-display pb-2 border-b border-stone-200/80">Liquid Capital Net Formula</h3>
            <div className="flex justify-between items-center text-xs">
              <span className="text-stone-500 font-medium font-display">Inbound Cash-routed Income</span>
              <span className="font-extrabold text-emerald-700">+{formatPeso(cashRoutedIncome)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-stone-500 font-medium font-display">Outbound Cash-routed Expense</span>
              <span className="font-extrabold text-red-700">−{formatPeso(
                state.expenses
                  .filter(e => e.paymentSourceType === 'cash')
                  .reduce((sum, e) => sum + e.amount, 0)
              )}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-stone-500 font-medium font-display">Cash movement adjustments</span>
              <span className="font-semibold text-stone-600">Neutral ⇄</span>
            </div>
            <div className="pt-2 border-t border-stone-200/80 flex justify-between items-center text-xs font-extrabold">
              <span className="text-stone-800 uppercase tracking-widest font-display text-[10px]">Computed sum</span>
              <span className={`text-sm font-black font-display ${cashOnHandTotal >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatPeso(cashOnHandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Headroom Breakdowns - Minimal Custom Modal Popups */}
      {detailModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start gap-4 mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-stone-900 tracking-tight font-display">
                  {detailModal === 'cash' ? 'Liquid Cash Breakdown' :
                   detailModal === 'salary' ? 'Expected Salary Breakdown' :
                   detailModal === 'additional' ? 'Expected Consulting Breakdown' :
                   detailModal === 'budget' ? 'Allowable Budget Cap Remaining' :
                   'Credit Card Exposures'}
                </h3>
                <p className="text-xs text-stone-500 font-semibold mt-1">
                  How these positions are computed inside the tracking engine
                </p>
              </div>
              <button 
                onClick={() => setDetailModal(null)}
                className="text-stone-400 hover:text-stone-600 font-bold text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body Contents */}
            {detailModal === 'cash' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-stone-200/30 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="font-bold text-stone-600 uppercase tracking-widest font-display text-[10px]">Total Liquid Assets</span>
                    <span className="block text-xl font-black font-display text-emerald-800 mt-0.5">{formatPeso(cashOnHandTotal)}</span>
                  </div>
                  <button 
                    onClick={() => {
                      setDetailModal(null);
                      onAddCashAccount();
                    }}
                    className="bg-stone-900 text-stone-50 hover:bg-stone-800 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1 shadow-sm font-display cursor-pointer"
                  >
                    <Plus size={11} /> Add Pool
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {state.cashAccounts.length === 0 ? (
                    <div className="text-center py-6 text-stone-400 font-semibold italic">No cash pools defined yet</div>
                  ) : (
                    state.cashAccounts.map(item => {
                      const activity = getCashAccountActivity(item.id);
                      return (
                        <div key={item.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex justify-between items-center hover:bg-stone-100/50 transition">
                          <span className="font-extrabold text-stone-700 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: item.color }}></span>
                            {item.name}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className={`font-black font-display ${activity >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {formatPeso(activity)}
                            </span>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to remove the Cash Pool "${item.name}"?`)) {
                                  onDeleteCashAccount(item.id);
                                }
                              }}
                              className="text-stone-400 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                              title="Delete Cash Pool"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {detailModal === 'salary' && (
              <div className="space-y-4 text-xs">
                <div className="bg-stone-200/30 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>Expected Combined Net Salaries</span>
                    <span className="text-emerald-800 font-black">{formatPeso(expectedSalaryNet)}</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>Aiden Take-home (less SSS, PHIC, Tax)</span>
                    <span>{formatPeso(state.salaries.you - getDeductionTotal('you'))}</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>Chloe Take-home (less SSS, PHIC, Tax)</span>
                    <span>{formatPeso(state.salaries.partner - getDeductionTotal('partner'))}</span>
                  </div>
                </div>

                <div className="p-3 bg-red-50/50 text-red-900 rounded-xl border border-red-100 flex justify-between">
                  <span className="font-bold">Total Salaries Received This Month ({formatMonth(currentMonthKey)})</span>
                  <span className="font-black">− {formatPeso(salaryReceivedThisMonth)}</span>
                </div>

                <div className="p-4 bg-indigo-50 text-indigo-950 font-extrabold border border-indigo-100 rounded-xl flex justify-between items-center">
                  <span>SALARY OUTSTANDING TO RECEIVE</span>
                  <span className="text-lg font-black text-indigo-700 font-display">{formatPeso(salaryToReceive)}</span>
                </div>
              </div>
            )}

            {detailModal === 'additional' && (
              <div className="space-y-4 text-xs">
                <div className="bg-stone-200/30 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>Assigned Consulting Channels (Expected)</span>
                    <span className="text-emerald-800 font-black">{formatPeso(expectedAdditionalIncome)}</span>
                  </div>
                  {state.incomeSources.map(s => (
                    <div key={s.id} className="flex justify-between text-stone-500">
                      <span>{s.desc} ({s.earner === 'you' ? state.partnerNames.you : state.partnerNames.partner})</span>
                      <span>{formatPeso(s.expectedAmt)}</span>
                    </div>
                  ))}
                  {state.incomeSources.length === 0 && (
                    <div className="text-stone-400 italic text-center py-2">No additional consulting channels defined</div>
                  )}
                </div>

                <div className="p-3 bg-red-50/50 text-red-900 rounded-xl border border-red-100 flex justify-between">
                  <span className="font-bold">Consulting Streams Already Logged this Month</span>
                  <span className="font-black">− {formatPeso(additionalReceivedThisMonth)}</span>
                </div>

                <div className="p-4 bg-indigo-50 text-indigo-950 font-extrabold border border-indigo-100 rounded-xl flex justify-between items-center">
                  <span>OUTSTANDING CHANNELS TO RECEIVE</span>
                  <span className="text-lg font-black text-indigo-700 font-display">{formatPeso(additionalIncomeToReceive)}</span>
                </div>
              </div>
            )}

            {detailModal === 'budget' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-stone-200/30 rounded-xl flex justify-between">
                  <span className="font-bold text-stone-600">Total Unused Allowable Budget Cap</span>
                  <span className="font-black text-red-800 font-display">{formatPeso(remainingBudgetTotal)}</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {state.budgets.map(b => {
                    const spent = getSpentByCategory(b.cat);
                    const limit = getBudgetLimitForMonth(b);
                    const remaining = Math.max(0, limit - spent);
                    return (
                      <div key={b.id} className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 flex justify-between items-center">
                        <div>
                          <div className="font-extrabold text-stone-700 flex items-center gap-1.5">
                            <span>{b.icon}</span> <span>{b.label}</span>
                          </div>
                          <div className="text-[10px] text-stone-400 mt-0.5">
                            Cap of {formatPeso(limit, 0)} · Logged spend {formatPeso(spent, 0)}
                          </div>
                        </div>
                        <span className={`font-black ${remaining > 0 ? 'text-indigo-800' : 'text-stone-400'}`}>
                          {formatPeso(remaining)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {detailModal === 'credit' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-stone-200/30 rounded-xl flex justify-between">
                  <span className="font-bold text-stone-600">Total Credit Owed (Dynamics Cards Liability)</span>
                  <span className="font-black text-red-800 font-display">{formatPeso(creditCardTotalOwed)}</span>
                </div>
                <div className="space-y-2">
                  {state.cards.map(card => {
                    const owed = getCardOwedTotal(card.id);
                    const dueInfo = getCardDueInfo(card.dueDay);
                    return (
                      <div key={card.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex justify-between items-center">
                        <div>
                          <div className="font-extrabold text-stone-800" style={{ borderLeft: `3px solid ${card.color}`, paddingLeft: '8px' }}>
                            {card.name}
                          </div>
                          <div className="text-[10px] text-stone-400 mt-1">
                            {dueInfo.label} ({dueInfo.dateLabel})
                          </div>
                        </div>
                        <span className="font-black text-red-700">{formatPeso(owed)}</span>
                      </div>
                    );
                  })}
                  {state.cards.length === 0 && (
                    <div className="text-stone-400 italic text-center py-2">No credit instruments added yet</div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setDetailModal(null)}
                className="bg-stone-900 text-stone-100 hover:bg-stone-800 text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Dismiss View
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
