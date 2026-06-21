/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Percent, 
  Trash2, 
  Calendar, 
  PlusCircle, 
  HelpCircle,
  FileSpreadsheet,
  AlertTriangle,
  Receipt,
  UserCheck,
  X 
} from 'lucide-react';
import { GlobalState, Budget, Amortization, Expense, CreditCard } from '../types';
import { 
  formatPeso, 
  getCategoryInfo, 
  CATEGORY_COLORS, 
  getMonthKey, 
  today, 
  formatMonth, 
  getAmortizationStatus, 
  parseMoney,
  CATEGORIES,
  formatDisplayDate,
  formatAsYouTypeHTML
} from '../utils';

interface AmountInputInlineProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
}

function AmountInputInline({ value, onChange, className = "w-24 text-xs font-extrabold border border-stone-200 rounded-lg p-1 px-2 outline-none focus:border-stone-400 bg-stone-100/50 focus:bg-stone-50 font-display text-right text-emerald-800" }: AmountInputInlineProps) {
  const [localVal, setLocalVal] = useState(value > 0 ? formatPeso(value) : '');
  const [isFocused, setIsFocused] = useState(false);

  React.useEffect(() => {
    // Only sync external prop value to local value when NOT actively editing
    if (!isFocused) {
      setLocalVal(value > 0 ? formatPeso(value) : '');
    }
  }, [value, isFocused]);

  const handleCommit = () => {
    const parsed = parseMoney(localVal);
    onChange(parsed);
    setLocalVal(parsed > 0 ? formatPeso(parsed) : '');
  };

  return (
    <input 
      type="text" 
      inputMode="decimal"
      className={className}
      value={localVal}
      onFocus={() => setIsFocused(true)}
      onChange={e => {
        const typing = formatAsYouTypeHTML(e.target.value);
        setLocalVal(typing);
      }}
      onBlur={() => {
        setIsFocused(false);
        handleCommit();
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

interface BudgetStrategyProps {
  state: GlobalState;
  addBudget: (cat: string, limit: number) => void;
  deleteBudget: (id: string) => void;
  updateBudgetLimit: (id: string, limit: number, monthKey: string) => void;
  addAmortization: (name: string, cat: string, amount: number, start: string, term: number, recurringCardId: string) => void;
  deleteAmortization: (id: string) => void;
  budgetMonth: string;
  setBudgetMonth: (month: string) => void;
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
}

export default function BudgetStrategy({
  state,
  addBudget,
  deleteBudget,
  updateBudgetLimit,
  addAmortization,
  deleteAmortization,
  budgetMonth,
  setBudgetMonth,
  activeModal,
  setActiveModal
}: BudgetStrategyProps) {
  // Modal detail targets
  const [selectedBudgetSoa, setSelectedBudgetSoa] = useState<Budget | null>(null);

  // Form states
  const [newBgtCat, setNewBgtCat] = useState('food');
  const [newBgtLimit, setNewBgtLimit] = useState('');

  const [amortName, setAmortName] = useState('');
  const [amortCat, setAmortCat] = useState('transport');
  const [amortAmt, setAmortAmt] = useState('');
  const [amortStart, setAmortStart] = useState(today());
  const [amortTerm, setAmortTerm] = useState('36');
  const [amortCard, setAmortCard] = useState('');

  // Get active month key
  const selectedMonthKey = budgetMonth === 'current' ? getMonthKey(today()) : budgetMonth;

  // Gather unique months logged in state
  const getBudgetMonthOptions = () => {
    const dates = new Set([
      ...state.receivedIncome.map(i => getMonthKey(i.date)),
      ...state.expenses.map(e => getMonthKey(e.date))
    ]);
    dates.add(getMonthKey(today()));
    const sorted = Array.from(dates).filter(Boolean).sort().reverse();
    return sorted;
  };

  const bgtMonths = getBudgetMonthOptions();

  // Helper spent calculator
  const getSpentByCategory = (cat: string) => {
    return state.expenses
      .filter(e => getMonthKey(e.date) === selectedMonthKey && e.cat === cat && e.type !== 'card_payment')
      .reduce((sum, e) => sum + e.amount, 0);
  };

  // Monthly expected combine taking home net income
  const getDeductionTotal = (earner: 'you' | 'partner') => {
    const d = state.deductions[earner];
    return d.sss + d.phic + d.hdmf + d.tax;
  };
  const expectedMonthlyNetIncome = (
    (state.salaries.you - getDeductionTotal('you')) + 
    (state.salaries.partner - getDeductionTotal('partner')) +
    state.incomeSources.reduce((sum, s) => sum + s.expectedAmt, 0)
  );

  // ─── AMORTIZATION METRICS ───
  const getAmortizationPaymentTotal = (item: Amortization) => {
    // manual logged spend in item's category
    const manualExpenses = state.expenses
      .filter(e => e.cat === item.cat && getMonthKey(e.date) === selectedMonthKey && e.type !== 'card_payment')
      .reduce((sum, e) => sum + e.amount, 0);

    // auto card charges
    const status = getAmortizationStatus(item, new Date());
    const recurringCount = item.recurringCardId && status.active ? item.monthlyAmount : 0;
    return manualExpenses + recurringCount;
  };

  const getAmortizationBudgetTotals = () => {
    const due = state.amortizations.reduce((sum, item) => {
      const status = getAmortizationStatus(item, new Date());
      return sum + (status.active ? item.monthlyAmount : 0);
    }, 0);
    const paid = state.amortizations.reduce((sum, item) => sum + getAmortizationPaymentTotal(item), 0);
    return { due, paid, remaining: Math.max(0, due - paid) };
  };

  const amortTotals = getAmortizationBudgetTotals();

  // Helper limits getter
  const getBudgetLimitForMonth = (b: Budget) => {
    if (b.cat === 'amortization') {
      return amortTotals.remaining;
    }
    const monthMap = state.monthlyBudgets[selectedMonthKey] || {};
    if (monthMap[b.id] !== undefined) return monthMap[b.id];
    if (monthMap[b.cat] !== undefined) return monthMap[b.cat];
    return b.limit;
  };

  // ─── EXTENDED CATEGORY SOA METRICS ───
  const getBudgetCategoryTransactionRows = (cat: string) => {
    // direct manual expenses
    const direct = state.expenses
      .filter(e => e.cat === cat && getMonthKey(e.date) === selectedMonthKey && e.type !== 'card_payment')
      .map(e => ({ ...e, typeTag: 'direct' }));

    // recurring amortization charges mapped under group
    const recurring = state.amortizations
      .filter(a => a.cat === cat && a.recurringCardId)
      .map(a => {
        const s = getAmortizationStatus(a, new Date());
        return {
          id: `recam_${a.id}`,
          desc: `${a.name} (Recurring Auto-charge)`,
          amount: a.monthlyAmount,
          date: selectedMonthKey + '-15',
          cat: cat,
          via: state.cards.find(c => c.id === a.recurringCardId)?.name || 'Credit Card',
          earner: 'Joint',
          typeTag: 'recurring'
        };
      });

    return [...direct, ...recurring].sort((a,b) => a.date.localeCompare(b.date));
  };

  const getPartnerContributions = (rows: any[]) => {
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const shares = { You: 0, Partner: 0, Joint: 0 };
    rows.forEach(r => {
      if (r.earner === 'You') shares.You += r.amount;
      else if (r.earner === 'Partner') shares.Partner += r.amount;
      else shares.Joint += r.amount;
    });

    return [
      { name: state.partnerNames.you, key: 'You', val: shares.You, pct: total > 0 ? (shares.You / total) * 100 : 0, color: 'text-emerald-700 bg-emerald-50' },
      { name: state.partnerNames.partner, key: 'Partner', val: shares.Partner, pct: total > 0 ? (shares.Partner / total) * 100 : 0, color: 'text-indigo-700 bg-indigo-50' },
      { name: 'Joint Account', key: 'Joint', val: shares.Joint, pct: total > 0 ? (shares.Joint / total) * 100 : 0, color: 'text-amber-800 bg-amber-50' }
    ].filter(s => s.val > 0 || total === 0);
  };

  // ─── ACTION TRIGGER SUBMITTERS ───
  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseMoney(newBgtLimit);
    if (!newBgtCat || limit <= 0) return;

    if (state.budgets.some(b => b.cat === newBgtCat)) {
      alert('This budget category cap has already been instantiated. Modify limit details directly on cards.');
      return;
    }

    addBudget(newBgtCat, limit);
    setNewBgtCat('food');
    setNewBgtLimit('');
    setActiveModal(null);
  };

  const handleAmortizationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseMoney(amortAmt);
    const months = parseInt(amortTerm) || 12;

    if (!amortName.trim() || amt <= 0) return;

    addAmortization(
      amortName.trim(),
      amortCat,
      amt,
      amortStart,
      months,
      amortCard
    );

    // Auto add budget category for amortization if not present
    if (!state.budgets.some(b => b.cat === 'amortization')) {
      addBudget('amortization', amt);
    }

    setAmortName('');
    setAmortAmt('');
    setAmortStart(today());
    setAmortTerm('36');
    setAmortCard('');
    setActiveModal(null);
  };

  return (
    <div className="space-y-6">
      {/* Upper toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black font-display text-stone-900 tracking-tight">Threshold Strategy</h1>
          <p className="text-stone-500 font-semibold text-xs mt-0.5">Control active limits, balance ratios, and fixed amortization debts</p>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center justify-end self-start md:self-auto">
          <select
            className="text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-50 outline-none focus:border-stone-400 cursor-pointer shadow-sm min-w-44"
            value={budgetMonth}
            onChange={e => setBudgetMonth(e.target.value)}
          >
            <option value="current">Current Month ({formatMonth(getMonthKey(today()))})</option>
            {bgtMonths.map(m => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
          <button 
            onClick={() => setActiveModal('addBudget')}
            className="bg-stone-900 text-stone-50 hover:bg-stone-850 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition font-display"
          >
            + Category
          </button>
        </div>
      </div>

      {/* Categories bounds grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.budgets.map(b => {
          const spent = getSpentByCategory(b.cat);
          const limit = getBudgetLimitForMonth(b);
          const percentVal = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
          const excess = spent - limit;
          const over = spent > limit;

          // SVG visual calculations for progress gauge
          const strokeColor = over ? '#D94F4F' : (CATEGORY_COLORS[b.cat] || '#0D9E80');
          const strokeDashoffset = 213.6 * (1 - percentVal / 100);

          return (
            <div 
              key={b.id}
              className={`bg-stone-50 rounded-3xl p-5 border flex justify-between space-x-4 items-center transition relative shadow-sm ${
                over ? 'border-red-200 bg-red-50/5' : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              {/* Radial circle spent indicator */}
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg width="80" height="80" className="transform -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#EDEDED" strokeWidth="6" />
                  <circle 
                    cx="40" 
                    cy="40" 
                    r="34" 
                    fill="none" 
                    stroke={strokeColor} 
                    strokeWidth="6" 
                    strokeLinecap="round"
                    strokeDasharray="213.6"
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-350"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center font-display leading-none">
                  <span className="text-lg">{b.icon}</span>
                  <span className="text-[10px] font-black mt-1 font-display" style={{ color: strokeColor }}>
                    {limit > 0 ? Math.round((spent / limit) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Text metric context */}
              <div className="flex-1 min-w-0 space-y-1.5 self-start">
                <div className="flex justify-between items-start gap-1">
                  <h4 className="font-extrabold text-stone-900 font-display text-sm truncate">{b.label}</h4>
                  <button 
                    onClick={() => {
                      if (confirm(`Remove ${b.label} category? Historical transaction amounts remain but monthly caps won't list.`)) {
                        deleteBudget(b.id);
                      }
                    }}
                    className="text-stone-300 hover:text-red-650 transition self-center p-0.5"
                  >
                    &times;
                  </button>
                </div>

                <div className="text-xs text-stone-950 font-bold font-display">
                  {formatPeso(spent)} <span className="text-stone-400 font-semibold">/ Cap:</span>
                </div>

                {/* Inline limit input */}
                <div className="flex items-center gap-1 min-h-[28px]">
                  {b.cat === 'amortization' ? (
                    <span className="text-xs font-black text-stone-800 font-display select-none py-1 bg-stone-200/50 rounded-lg px-2.5" title="Automatically linked to unpaid amortization schedule dues">
                      {formatPeso(limit)} <span className="text-[9px] font-bold text-stone-500 uppercase ml-1">Auto</span>
                    </span>
                  ) : (
                    <>
                      <span className="text-[10px] text-stone-400 font-extrabold">₱</span>
                      <AmountInputInline 
                        value={limit}
                        onChange={val => updateBudgetLimit(b.id, val, selectedMonthKey)}
                      />
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-200/50">
                  <button
                    onClick={() => setSelectedBudgetSoa(b)}
                    className="text-[10px] font-extrabold text-stone-500 hover:text-stone-800 transition uppercase tracking-wider font-display"
                  >
                    Category SOA
                  </button>
                  <span className={`text-[10px] font-bold leading-none ${over ? 'text-red-700' : 'text-stone-500'}`}>
                    {over ? `Short by ${formatPeso(excess, 0)}` : `${formatPeso(limit - spent, 0)} free`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {state.budgets.length === 0 && (
          <div className="col-span-1 sm:col-span-2 lg:col-span-3 text-center py-16 border border-dashed border-stone-300 rounded-3xl bg-stone-50/50">
            <span className="text-3xl">🎯</span>
            <h4 className="text-stone-800 font-black text-sm font-display mt-2">No Active Budgets Mapped</h4>
            <p className="text-stone-400 text-xs font-semibold mt-1 max-w-sm mx-auto">
              Define caps for groceries, utilities, vacations, or dates. The tracking engine compares spent segments automatically!
            </p>
          </div>
        )}
      </div>

      {/* Amortization schedule matrix cardboard block */}
      <div className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-stone-200">
          <div>
            <h3 className="text-base font-extrabold text-stone-950 font-display tracking-tight flex items-center gap-2">
              🧾 Amortization Schedule
            </h3>
            <p className="text-xs text-stone-400 font-semibold mt-0.5 leading-relaxed">
              Plan fixed installments (cars, appliances, loans). Dues dynamically roll into standard Amortization caps.
            </p>
          </div>
          <button
            onClick={() => setActiveModal('addAmortization')}
            className="bg-stone-50 border border-stone-300 text-stone-700 hover:text-stone-900 text-xs font-bold px-3 py-2 rounded-xl transition shadow-sm font-display self-stretch sm:self-auto text-center"
          >
            + Add Amortization
          </button>
        </div>

        {/* Amortization microstats panel */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-stone-200/40 border border-stone-200 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider font-display">Combined Due this Month</span>
            <div className="text-xl font-black text-red-700 font-display mt-1">{formatPeso(amortTotals.due)}</div>
          </div>
          <div className="bg-stone-200/40 border border-stone-200 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider font-display">Payments Checked</span>
            <div className="text-xl font-black text-emerald-800 font-display mt-1">{formatPeso(amortTotals.paid)}</div>
          </div>
          <div className="bg-stone-200/40 border border-stone-200 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider font-display">Unpaid Dues</span>
            <div className={`text-xl font-black font-display mt-1 ${amortTotals.remaining > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {formatPeso(amortTotals.remaining)}
            </div>
          </div>
        </div>

        {/* Amortization items list */}
        <div className="space-y-3">
          {state.amortizations.map(amort => {
            const status = getAmortizationStatus(amort, new Date());
            const paid = getAmortizationPaymentTotal(amort);
            const remaining = Math.max(0, status.monthlyAmount - paid);
            const isCompleted = status.completed;
            const statusColor = isCompleted ? 'text-emerald-700' : status.active ? 'text-indigo-700' : 'text-amber-800';

            return (
              <div 
                key={amort.id}
                className="bg-stone-50 rounded-2xl border border-stone-200/80 p-5 flex flex-col lg:flex-row justify-between lg:items-center gap-4 hover:border-stone-300 transition"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="font-extrabold text-stone-900 font-display text-sm truncate">{amort.name}</h5>
                    {amort.recurringCardId && (
                      <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 font-extrabold px-2 py-0.5 rounded text-[8px] font-display">
                        💳 AUTO-CHARGE BILLING
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-400 font-semibold leading-relaxed flex flex-wrap gap-2 items-center">
                    <span>Budget assignment: {getCategoryInfo(amort.cat).i} {getCategoryInfo(amort.cat).l}</span>
                    <span>·</span>
                    <span>Date Start: {formatDisplayDate(amort.startDate)}</span>
                    <span>·</span>
                    <span>Finish: {status.finishLabel}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-4 flex-shrink-0 font-display text-xs">
                  <div className="p-2.5 bg-stone-100 rounded-xl">
                    <span className="text-[9px] font-bold text-stone-400 uppercase block">Monthly</span>
                    <strong className="text-[13px] font-extrabold text-stone-850 block mt-0.5">{formatPeso(amort.monthlyAmount, 0)}</strong>
                  </div>
                  <div className="p-2.5 bg-stone-100 rounded-xl">
                    <span className="text-[9px] font-bold text-stone-400 uppercase block">Spent Log</span>
                    <strong className="text-[13px] font-extrabold text-emerald-800 block mt-0.5">{formatPeso(paid, 0)}</strong>
                  </div>
                  <div className="p-2.5 bg-stone-100 rounded-xl">
                    <span className="text-[9px] font-bold text-stone-400 uppercase block">Remaining</span>
                    <strong className={`text-[13px] font-extrabold block mt-0.5 ${remaining > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatPeso(remaining, 0)}</strong>
                  </div>
                </div>

                <div className="flex justify-between lg:flex-col items-center lg:items-end gap-2 flex-shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-stone-200">
                  <span className={`text-[11px] font-black font-display uppercase tracking-wider ${statusColor}`}>
                    {status.statusLabel}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${amort.name} installment schedule?`)) {
                        deleteAmortization(amort.id);
                      }
                    }}
                    className="text-stone-400 hover:text-red-600 text-xs font-semibold px-2 py-1 hover:bg-red-50 rounded-lg transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}

          {state.amortizations.length === 0 && (
            <div className="text-center py-10 text-stone-400 text-xs italic font-semibold">
              No active amortization installment schedules configured.
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL CONTROLLERS ─── */}
      <AnimatePresence>
        {/* 1. Add Budget Category Modal */}
        {activeModal === 'addBudget' && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-2xl w-full max-w-sm max-h-[92vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5 pb-2 border-b border-stone-200/80">
                <h3 className="text-lg font-black tracking-tight text-stone-900 font-display flex items-center gap-1.5">
                  🎯 Instantiate Budget Group
                </h3>
                <button onClick={() => setActiveModal(null)} className="text-stone-400 hover:text-stone-700">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleBudgetSubmit} className="space-y-4 text-xs font-semibold text-stone-700">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Target Category</label>
                  <select 
                    className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400"
                    value={newBgtCat}
                    onChange={e => setNewBgtCat(e.target.value)}
                    required
                  >
                    {CATEGORIES.filter(c => c.v !== 'card_payment' && c.v !== 'amortization').map(c => (
                      <option key={c.v} value={c.v}>{c.i} {c.l}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Target Monthly Cap (₱)</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    className="w-full text-xs font-black border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 text-right font-display text-emerald-855"
                    placeholder="₱ 15000.00"
                    value={newBgtLimit}
                    onChange={e => setNewBgtLimit(formatAsYouTypeHTML(e.target.value))}
                    onBlur={e => {
                      const num = parseMoney(e.target.value);
                      setNewBgtLimit(num > 0 ? formatPeso(num) : '');
                    }}
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-stone-200/80">
                  <button type="button" onClick={() => setActiveModal(null)} className="btn btn-ghost">Cancel</button>
                  <button type="submit" className="btn btn-primary bg-stone-900 hover:bg-stone-850">Establish Allocation</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 2. Add Amortization Schedule modal */}
        {activeModal === 'addAmortization' && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5 pb-2 border-b border-stone-200/80">
                <h3 className="text-lg font-black tracking-tight text-stone-900 font-display flex items-center gap-1.5">
                  🧾 Instantiate Amortization
                </h3>
                <button onClick={() => setActiveModal(null)} className="text-stone-400 hover:text-stone-700">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAmortizationSubmit} className="space-y-4 text-xs font-semibold text-stone-700">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Installment Name</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 focus:bg-stone-50 transition"
                    placeholder="e.g. Mazda 3 Car Loan, Platinum Couples Stash"
                    value={amortName}
                    onChange={e => setAmortName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Target Budget Group</label>
                    <select 
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400"
                      value={amortCat}
                      onChange={e => setAmortCat(e.target.value)}
                      required
                    >
                      {CATEGORIES.filter(c => c.v !== 'card_payment' && c.v !== 'amortization').map(c => (
                        <option key={c.v} value={c.v}>{c.i} {c.l}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Monthly Amort Rate (₱)</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      className="w-full text-xs font-black border border-stone-250 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 text-right font-display text-red-800"
                      placeholder="₱ 18500.00"
                      value={amortAmt}
                      onChange={e => setAmortAmt(formatAsYouTypeHTML(e.target.value))}
                      onBlur={e => {
                        const num = parseMoney(e.target.value);
                        setAmortAmt(num > 0 ? formatPeso(num) : '');
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Start Date</label>
                    <input 
                      type="date" 
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 font-display"
                      value={amortStart}
                      onChange={e => setAmortStart(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Term Duration (Months)</label>
                    <input 
                      type="number" 
                      min="1"
                      className="w-full text-xs font-bold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 font-display"
                      placeholder="e.g. 60"
                      value={amortTerm}
                      onChange={e => setAmortTerm(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Revolving Credit Card Auto-Billing</label>
                  <select 
                    className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400"
                    value={amortCard}
                    onChange={e => setAmortCard(e.target.value)}
                  >
                    <option value="">No revolving auto-charge billing</option>
                    {state.cards.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.bank})</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-stone-400 mt-1.5 leading-relaxed font-semibold">
                    💡 Selecting a card will instruct the engine to auto-charge monthly payments to your revolving credit statement till finished.
                  </p>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-stone-200/80">
                  <button type="button" onClick={() => setActiveModal(null)} className="btn btn-ghost">Cancel</button>
                  <button type="submit" className="btn btn-primary bg-stone-900 hover:bg-stone-850">Record Installment</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 3. Category Statement (SOA) Modal */}
        {selectedBudgetSoa && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-black font-display text-stone-900 tracking-tight flex items-center gap-1.5">
                    <span>{selectedBudgetSoa.icon}</span> <span>{selectedBudgetSoa.label} — Category SOA</span>
                  </h3>
                  <p className="text-xs text-stone-400 font-bold mt-0.5">
                    Itemized segment spend and couple contribution proportions for <span className="text-stone-700">{formatMonth(selectedMonthKey)}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedBudgetSoa(null)} 
                  className="text-stone-400 hover:text-stone-700 font-bold text-xl leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Aggregation stat blocks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-stone-100 p-4 rounded-2xl flex flex-col justify-between border border-stone-200/50">
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest font-display">Target Cap Limit</span>
                  <strong className="text-lg font-black font-display text-stone-800 mt-1">
                    {formatPeso(getBudgetLimitForMonth(selectedBudgetSoa))}
                  </strong>
                </div>

                <div className="bg-stone-100 p-4 rounded-2xl flex flex-col justify-between border border-stone-200/50">
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest font-display">Spent Outlay</span>
                  <strong className="text-lg font-black font-display text-red-800 mt-1">
                    {formatPeso(getSpentByCategory(selectedBudgetSoa.cat))}
                  </strong>
                </div>

                <div className="bg-stone-100 p-4 rounded-2xl flex flex-col justify-between border border-stone-200/50">
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest font-display">Remaining Scope</span>
                  <strong className={`text-lg font-black font-display mt-1 ${
                    getBudgetLimitForMonth(selectedBudgetSoa) - getSpentByCategory(selectedBudgetSoa.cat) >= 0 ? 'text-emerald-800' : 'text-red-800'
                  }`}>
                    {formatPeso(getBudgetLimitForMonth(selectedBudgetSoa) - getSpentByCategory(selectedBudgetSoa.cat))}
                  </strong>
                </div>
              </div>

              <div className="space-y-6">
                {/* Couple contributions bar & statistics */}
                <div className="bg-stone-100 border border-stone-200/50 rounded-2xl p-5 text-xs space-y-4">
                  <h4 className="font-extrabold text-stone-800 font-display text-xs">Cost Contribution proportions</h4>
                  
                  {/* Visual segment slider */}
                  <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden flex">
                    {getPartnerContributions(getBudgetCategoryTransactionRows(selectedBudgetSoa.cat)).map(s => (
                      <div 
                        key={s.key} 
                        className="h-full transition-all" 
                        style={{ 
                          width: `${s.pct}%`, 
                          backgroundColor: s.key === 'You' ? '#0D9E80' : s.key === 'Partner' ? '#4F54D4' : '#D97706'
                        }}
                        title={`${s.name}: ${s.pct.toFixed(1)}%`}
                      ></div>
                    ))}
                  </div>

                  {/* Indicators details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {getPartnerContributions(getBudgetCategoryTransactionRows(selectedBudgetSoa.cat)).map(s => (
                      <div key={s.key} className={`p-3 rounded-xl border border-stone-200/40 flex flex-col justify-between ${s.color}`}>
                        <span className="font-bold uppercase tracking-wider text-[9px] block">{s.name}</span>
                        <div className="flex justify-between items-baseline mt-2.5 font-display">
                          <strong className="text-sm font-black">{formatPeso(s.val)}</strong>
                          <span className="text-[10px] font-black">{s.pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ledger items registered list */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-stone-500 font-display tracking-widest pb-1.5 border-b border-stone-200">
                    Category Itemized Outlay
                  </h4>
                  {getBudgetCategoryTransactionRows(selectedBudgetSoa.cat).length === 0 ? (
                    <div className="text-center py-8 text-stone-400 italic font-semibold text-xs border border-dashed border-stone-200 rounded-2xl">
                      No allocations registered in {selectedBudgetSoa.label} for {formatMonth(selectedMonthKey)} yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {getBudgetCategoryTransactionRows(selectedBudgetSoa.cat).map(row => (
                        <div key={row.id} className="p-3 bg-stone-50 hover:bg-stone-100/40 border border-stone-200 rounded-xl flex justify-between items-center transition text-xs">
                          <div>
                            <div className="font-extrabold text-stone-800">
                              {row.desc}
                              {row.typeTag === 'recurring' && (
                                <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-indigo-50 border border-indigo-150 text-indigo-700">
                                  Recurring Group Amort
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-400 font-semibold mt-0.5">
                              {formatDisplayDate(row.date)} · Funded via {row.via} · Owner: {row.earner === 'You' ? state.partnerNames.you : row.earner === 'Partner' ? state.partnerNames.partner : 'Joint'}
                            </div>
                          </div>
                          <span className="font-black text-red-700">{formatPeso(row.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 flex justify-end pt-4 border-t border-stone-200">
                <button
                  onClick={() => setSelectedBudgetSoa(null)}
                  className="bg-stone-900 text-stone-100 hover:bg-stone-850 font-bold text-xs px-4 py-2 rounded-xl transition"
                >
                  Dismiss SOA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
