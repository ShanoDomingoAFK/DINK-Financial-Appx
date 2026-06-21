/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ChevronDown, 
  PlusCircle, 
  Trash2, 
  Edit3, 
  ArrowRightLeft, 
  HelpCircle,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  X 
} from 'lucide-react';
import { GlobalState, ReceivedIncome, Expense, FundTransfer, CashAccount, CreditCard } from '../types';
import { 
  formatPeso, 
  getCategoryInfo, 
  CATEGORY_COLORS, 
  getMonthKey, 
  today, 
  formatMonth, 
  formatDisplayDate,
  toDateObject,
  CATEGORIES,
  parseMoney,
  getAmortizationStatus,
  getCardLastStatementDue,
  formatAsYouTypeHTML
} from '../utils';

interface TransactionsProps {
  state: GlobalState;
  addIncome: (desc: string, amount: number, date: string, via: string, paymentSourceId: string, earner: string, type: 'salary' | 'additional') => void;
  addExpense: (desc: string, amount: number, date: string, cat: string, via: string, paymentSourceType: 'cash' | 'card', paymentSourceId: string, earner: string) => void;
  addTransfer: (desc: string, amount: number, date: string, fromId: string, toId: string) => void;
  deleteIncome: (id: string) => void;
  deleteExpense: (id: string) => void;
  deleteTransfer: (id: string) => void;
  updateIncome: (id: string, updated: Partial<ReceivedIncome>) => void;
  updateExpense: (id: string, updated: Partial<Expense>) => void;
  updateTransfer: (id: string, updated: Partial<FundTransfer>) => void;
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
  settleCardId?: string;
  setSettleCardId?: (cardId: string) => void;
}

export default function Transactions({
  state,
  addIncome,
  addExpense,
  addTransfer,
  deleteIncome,
  deleteExpense,
  deleteTransfer,
  updateIncome,
  updateExpense,
  updateTransfer,
  activeModal,
  setActiveModal,
  settleCardId = '',
  setSettleCardId
}: TransactionsProps) {
  // ─── FILTER STATES ───
  const [txSearch, setTxSearch] = useState('');
  const [txType, setTxType] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [txCategory, setTxCategory] = useState('all');
  const [txMonth, setTxMonth] = useState('all');

  // ─── TRANSACTION EDITING STATES ───
  const [editTx, setEditTx] = useState<{ rowType: 'income' | 'expense' | 'transfer'; itemItem: any } | null>(null);

  // ─── PREPARE FILTER OPTION LISTS ───
  const getMonthOptions = () => {
    const dates = new Set([
      ...state.receivedIncome.map(i => getMonthKey(i.date)),
      ...state.expenses.map(e => getMonthKey(e.date)),
      ...state.transfers.map(t => getMonthKey(t.date))
    ]);
    dates.add(getMonthKey(today()));
    return Array.from(dates).filter(Boolean).sort().reverse();
  };

  const months = getMonthOptions();

  // Helper payment source visuals resolver
  const getPaymentSourceVisual = (tx: any, rowType: string) => {
    if (rowType === 'transfer') {
      const fromAcc = state.cashAccounts.find(a => a.id === tx.fromCashAccountId);
      const toAcc = state.cashAccounts.find(a => a.id === tx.toCashAccountId);
      return {
        typeLabel: 'Fund Transfer',
        name: `${fromAcc ? fromAcc.name : 'Unknown'} → ${toAcc ? toAcc.name : 'Unknown'}`,
        color: fromAcc ? fromAcc.color : '#4F54D4'
      };
    }
    
    if (tx.paymentSourceType === 'cash') {
      const acc = state.cashAccounts.find(a => a.id === tx.paymentSourceId);
      return {
        typeLabel: 'Cash Allocation',
        name: tx.via || (acc ? acc.name : 'Unknown Cash'),
        color: acc ? acc.color : '#0D9E80'
      };
    }
    
    if (tx.paymentSourceType === 'card') {
      const card = state.cards.find(c => c.id === tx.paymentSourceId);
      return {
        typeLabel: 'Direct Card',
        name: tx.via || (card ? card.name : 'Unknown Card'),
        color: card ? card.color : '#4F54D4'
      };
    }

    return {
      typeLabel: 'Other Ledger Method',
      name: tx.via || 'Unassigned',
      color: '#6B7280'
    };
  };

  // Convert and merge all transaction data to render a single dynamic table
  const getProcessedTransactions = () => {
    const rows: {
      id: string;
      rowType: 'income' | 'expense' | 'transfer';
      desc: string;
      amount: number;
      date: string;
      cat: string;
      via: string;
      paymentSourceType: 'cash' | 'card' | 'manual';
      paymentSourceId: string;
      earner: string;
      type?: string;
      cardPaymentCardId?: string;
      fromCashAccountId?: string;
      toCashAccountId?: string;
    }[] = [
      ...state.receivedIncome.map(i => ({ ...i, rowType: 'income' as const, cat: 'income' })),
      ...state.expenses.map(e => ({ ...e, rowType: 'expense' as const })),
      ...state.transfers.map(t => ({ 
        ...t, 
        rowType: 'transfer' as const, 
        cat: 'fund_transfer',
        via: 'Cash Account Offset',
        paymentSourceType: 'cash' as const,
        paymentSourceId: t.fromCashAccountId,
        earner: 'Joint Assets Transfer'
      }))
    ];

    return rows
      .filter(row => {
        // Class/Type filter
        if (txType !== 'all' && row.rowType !== txType) return false;
        
        // Category filter
        if (txCategory !== 'all') {
          if (txCategory === 'fund_transfer') {
            if (row.rowType !== 'transfer') return false;
          } else if (txCategory === 'card_payment') {
            if (row.cat !== 'card_payment' && row.type !== 'card_payment') return false;
          } else {
            if (row.cat !== txCategory) return false;
          }
        }

        // Selected Monthly Horizon
        if (txMonth !== 'all' && getMonthKey(row.date) !== txMonth) return false;

        // Keyword Queries
        if (txSearch.trim()) {
          const q = txSearch.toLowerCase().trim();
          const targetText = `${row.desc} ${row.via} ${row.earner} ${row.cat}`.toLowerCase();
          if (!targetText.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  const filteredRows = getProcessedTransactions();

  // Aggregators for filter values
  const filteredIncomeSum = filteredRows.filter(r => r.rowType === 'income').reduce((sum, r) => sum + r.amount, 0);
  const filteredSpentSum = filteredRows.filter(r => r.rowType === 'expense').reduce((sum, r) => sum + r.amount, 0);
  const filteredNetBalance = filteredIncomeSum - filteredSpentSum;

  // ─── ADD TRANSACTION HANDLERS ───
  const [incForm, setIncForm] = useState({ desc: '', amount: '', date: today(), via: '', earner: 'You', type: 'salary' as 'salary' | 'additional' });
  const [expForm, setExpForm] = useState({ desc: '', amount: '', date: today(), cat: 'food', via: '', earner: 'Joint' });
  const [transferForm, setTransferForm] = useState({ desc: '', amount: '', date: today(), fromId: '', toId: '' });
  const [settleForm, setSettleForm] = useState({ cardId: '', amount: '', date: today(), via: '', notes: '' });

  // Autofill sources when opening modals
  React.useEffect(() => {
    if (activeModal === 'addIncome' && state.cashAccounts.length > 0) {
      setIncForm(prev => ({ ...prev, via: `cash:${state.cashAccounts[0].id}` }));
    }
    if (activeModal === 'addExpense') {
      if (state.cashAccounts.length > 0) {
        setExpForm(prev => ({ ...prev, via: `cash:${state.cashAccounts[0].id}` }));
      } else if (state.cards.length > 0) {
        setExpForm(prev => ({ ...prev, via: `card:${state.cards[0].id}` }));
      }
    }
    if (activeModal === 'fundTransfer' && state.cashAccounts.length > 1) {
      setTransferForm(prev => ({ ...prev, fromId: state.cashAccounts[0].id, toId: state.cashAccounts[1].id }));
    }
    if (activeModal === 'settleCard') {
      const defaultCard = settleCardId || (state.cards[0]?.id || '');
      const cardObj = state.cards.find(c => c.id === defaultCard);
      const defaultOwed = cardObj ? getCardLastStatementDue(cardObj, state) : 0;
      setSettleForm({
        cardId: defaultCard,
        amount: defaultOwed > 0 ? formatAsYouTypeHTML(defaultOwed.toString()) : '',
        date: today(),
        via: state.cashAccounts[0] ? `cash:${state.cashAccounts[0].id}` : '',
        notes: ''
      });
    }
  }, [activeModal, state.cashAccounts, state.cards, settleCardId]);

  const handleIncomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseMoney(incForm.amount);
    if (!incForm.desc.trim() || amt <= 0 || !incForm.via) return;
    
    // Find payment destination
    const [sourceType, sourceId] = incForm.via.split(':');
    addIncome(
      incForm.desc.trim(),
      amt,
      incForm.date,
      incForm.via,
      sourceId,
      incForm.earner,
      incForm.type
    );
    setIncForm({ desc: '', amount: '', date: today(), via: incForm.via, earner: 'You', type: 'salary' });
    setActiveModal(null);
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseMoney(expForm.amount);
    if (!expForm.desc.trim() || amt <= 0 || !expForm.via) return;

    const [sourceType, sourceId] = expForm.via.split(':');
    addExpense(
      expForm.desc.trim(),
      amt,
      expForm.date,
      expForm.cat,
      expForm.via,
      sourceType as 'cash' | 'card',
      sourceId,
      expForm.earner
    );
    setExpForm({ desc: '', amount: '', date: today(), cat: 'food', via: expForm.via, earner: 'Joint' });
    setActiveModal(null);
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseMoney(transferForm.amount);
    if (amt <= 0 || !transferForm.fromId || !transferForm.toId || transferForm.fromId === transferForm.toId) {
      alert('Select distinct cash accounts to transfer capital.');
      return;
    }
    addTransfer(
      transferForm.desc.trim() || 'Internal Cash Transfer',
      amt,
      transferForm.date,
      transferForm.fromId,
      transferForm.toId
    );
    setTransferForm({ desc: '', amount: '', date: today(), fromId: '', toId: '' });
    setActiveModal(null);
  };

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseMoney(settleForm.amount);
    if (!settleForm.cardId || !settleForm.via || amt <= 0) return;

    const [sourceType, sourceId] = settleForm.via.split(':');
    const cardSelected = state.cards.find(c => c.id === settleForm.cardId);

    addExpense(
      settleForm.notes.trim() || `Settle Card: ${cardSelected ? cardSelected.name : 'Credit Card Statement'}`,
      amt,
      settleForm.date,
      'card_payment',
      settleForm.via,
      'cash' as 'cash',
      sourceId,
      'Joint'
    );
    // Explicitly note payment references if needed
    setActiveModal(null);
  };

  // SSS, PhilHealth, Pag-IBIG thresholds helper
  const getCardOwedTotal = (cardId: string) => {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return 0;
    const manualOutstanding = card.outstandingBalance;
    const itemizedCharges = state.expenses
      .filter(e => e.paymentSourceType === 'card' && e.paymentSourceId === cardId && e.type !== 'card_payment')
      .reduce((sum, e) => sum + e.amount, 0);

    const recurringCharges = state.amortizations
      .filter(item => item.recurringCardId === cardId)
      .reduce((sum, item) => {
        const s = getAmortizationStatus(item, new Date());
        return sum + (s.active ? item.monthlyAmount : 0);
      }, 0);

    const totalSettled = state.expenses
      .filter(e => e.type === 'card_payment' && e.cardPaymentCardId === cardId)
      .reduce((sum, e) => sum + e.amount, 0);

    return Math.max(0, manualOutstanding + itemizedCharges + recurringCharges - totalSettled);
  };

  return (
    <div className="space-y-6">
      {/* Upper toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black font-display text-stone-900 tracking-tight">Transactions</h1>
          <p className="text-stone-500 font-semibold text-xs mt-0.5">Central register to track, trace, and manage dynamic cash flow indicators</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setActiveModal('addIncome')}
            className="bg-stone-50 border border-stone-300 text-stone-700 hover:text-stone-900 text-xs font-bold px-3 py-2 rounded-xl transition shadow-sm font-display flex items-center gap-1.5"
          >
            + Log Income
          </button>
          <button 
            onClick={() => {
              if (setSettleCardId && state.cards[0]) {
                setSettleCardId(state.cards[0].id);
              }
              setActiveModal('settleCard');
            }}
            className="bg-stone-50 border border-stone-300 text-stone-700 hover:text-stone-900 text-xs font-bold px-3 py-2 rounded-xl transition shadow-sm font-display flex items-center gap-1.5"
          >
            💳 Settle Card Due
          </button>
          <button 
            onClick={() => setActiveModal('fundTransfer')}
            className="bg-stone-50 border border-stone-300 text-stone-700 hover:text-stone-900 text-xs font-bold px-3 py-2 rounded-xl transition shadow-sm font-display flex items-center gap-1.5"
          >
            <ArrowRightLeft size={13} /> Fund Transfer
          </button>
          <button 
            onClick={() => setActiveModal('addExpense')}
            className="bg-stone-900 text-stone-50 hover:bg-stone-800 text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm font-display flex items-center gap-1.5"
          >
            + Log Expense
          </button>
        </div>
      </div>

      {/* Overall Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 font-display">Combined Gross Salary</h3>
            <div className="p-1 px-2 rounded-md bg-stone-200/50 text-xs font-bold text-stone-700 font-display">Monthly Base</div>
          </div>
          <div className="text-2xl font-extrabold text-stone-900 mt-3 font-display tracking-tight">
            {formatPeso(state.salaries.you + state.salaries.partner)}
          </div>
          <p className="text-xs text-stone-400 font-semibold mt-2">
            Prior to taxation, contributions, and extras
          </p>
        </div>

        <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 font-display">Inbound Logged Revenue</h3>
          <div className="text-2xl font-extrabold text-emerald-700 mt-3 font-display tracking-tight">
            {formatPeso(state.receivedIncome.reduce((sum, item) => sum + item.amount, 0))}
          </div>
          <p className="text-xs text-stone-400 font-semibold mt-2">
            {state.receivedIncome.length} incoming positions recorded
          </p>
        </div>

        <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 font-display">Dynamic Paid Expenses</h3>
          <div className="text-2xl font-extrabold text-red-700 mt-3 font-display tracking-tight">
            {formatPeso(state.expenses.reduce((sum, item) => sum + item.amount, 0))}
          </div>
          <p className="text-xs text-stone-400 font-semibold mt-2">
            {state.expenses.length} distinct allocations recorded
          </p>
        </div>
      </div>

      {/* Structured Ledger Filters */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            className="w-full text-xs font-medium border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 bg-stone-100/50 outline-none focus:border-stone-400 focus:bg-stone-55 transition"
            placeholder="Search description, payee, cash labels..."
            value={txSearch}
            onChange={e => setTxSearch(e.target.value)}
          />
        </div>

        <select 
          className="text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 transition"
          value={txType}
          onChange={e => setTxType(e.target.value as any)}
        >
          <option value="all">All transaction classes</option>
          <option value="income">Inbound (Income)</option>
          <option value="expense">Outbound (Spend)</option>
          <option value="transfer">Internal (Transfers)</option>
        </select>

        <select 
          className="text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 transition"
          value={txCategory}
          onChange={e => setTxCategory(e.target.value)}
        >
          <option value="all">All Category streams</option>
          <option value="fund_transfer">⇄ Internal Fund Transfer</option>
          <option value="card_payment">💳 Line Settlements</option>
          {CATEGORIES.filter(c => c.v !== 'card_payment' && c.v !== 'amortization').map(c => (
            <option key={c.v} value={c.v}>{c.i} {c.l}</option>
          ))}
        </select>

        <select 
          className="text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 transition"
          value={txMonth}
          onChange={e => setTxMonth(e.target.value)}
        >
          <option value="all">All Monthly Horizons</option>
          {months.map(m => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>

        <button 
          onClick={() => {
            setTxSearch('');
            setTxType('all');
            setTxCategory('all');
            setTxMonth('all');
          }}
          className="text-xs text-stone-500 hover:text-stone-800 font-extrabold border border-stone-300 rounded-xl py-2.5 transition bg-stone-50/50 shadow-sm font-display text-center"
        >
          Reset Filters
        </button>
      </div>

      {/* Ledger Table Section */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-stone-500 font-display">Transactions</h3>
          <span className="text-xs bg-stone-200 text-stone-700 font-bold px-2.5 py-1 rounded-full font-display">
            {filteredRows.length} transactions match
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px] divide-y divide-stone-200/60">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-4 pb-3.5 text-[10px] font-extrabold text-stone-400 uppercase tracking-widest font-display">
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-3">Payment Source / Destination</div>
              <div className="col-span-1.5 text-right">Amount</div>
              <div className="col-span-0.5 text-right"></div>
            </div>

            {/* List entries */}
            <div className="pt-2 divide-y divide-stone-200/50">
              {filteredRows.length === 0 ? (
                <div className="text-center text-stone-400 py-12 text-sm font-semibold italic">
                  No matching ledger entries found in the selection criteria.
                </div>
              ) : (
                filteredRows.map(row => {
                  const isIncome = row.rowType === 'income';
                  const isTransfer = row.rowType === 'transfer';
                  const catData = isIncome 
                    ? { i: '↗', l: row.type === 'salary' ? 'Salary Income' : 'Additional Consulting' } 
                    : getCategoryInfo(row.cat);
                    
                  const paymentSource = getPaymentSourceVisual(row, row.rowType);
                  const color = isIncome ? 'text-emerald-700' : isTransfer ? 'text-indigo-700' : 'text-red-700';
                  const sign = isIncome ? '+' : isTransfer ? '⇄ ' : '−';

                  return (
                    <div key={row.id} className="grid grid-cols-12 gap-4 py-3.5 items-center hover:bg-stone-100/40 rounded-xl transition px-1">
                      <div className="col-span-2 text-xs font-extrabold text-stone-800 font-display">
                        <div>{formatDisplayDate(row.date)}</div>
                        <div className="text-[10px] text-stone-400 font-semibold mt-0.5">
                          {toDateObject(row.date)?.toLocaleDateString('en', { weekday: 'long' })}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold border border-stone-200 bg-stone-50 rounded-lg text-stone-700 selection:truncate max-w-full">
                          <span>{catData.i}</span>
                          <span className="truncate">{catData.l}</span>
                        </span>
                      </div>

                      <div className="col-span-3 space-y-0.5 min-w-0">
                        <div className="text-xs font-extrabold text-stone-900 truncate font-display">{row.desc}</div>
                        <div className="text-[10px] text-stone-500 font-semibold truncate flex items-center gap-1.5">
                          <span>Assignee:</span>
                          <span className={`font-bold ${row.earner === 'You' ? 'text-emerald-700' : row.earner === 'Partner' ? 'text-indigo-700' : 'text-amber-800'}`}>
                            {row.earner}
                          </span>
                        </div>
                      </div>

                      <div className="col-span-3 min-w-0">
                        <div className="inline-flex items-center gap-2 border-l-4 rounded-r-lg bg-stone-100/40 p-1.5 px-2.5 border-stone-200 max-w-full" style={{ borderLeftColor: paymentSource.color }}>
                          <div className="space-y-0.5 text-[10px] font-bold text-stone-400 font-display leading-none">
                            <div className="uppercase tracking-wider text-[8px] font-extrabold text-stone-400">{paymentSource.typeLabel}</div>
                            <div className="text-[12px] text-stone-800 mt-1 font-bold truncate max-w-xs">{paymentSource.name}</div>
                          </div>
                        </div>
                      </div>

                      <div className={`col-span-1.5 text-right font-display font-black text-sm ${color}`}>
                        {sign}{formatPeso(row.amount)}
                      </div>

                      <div className="col-span-0.5 flex justify-end gap-2 pr-1">
                        <button
                          onClick={() => {
                            if (row.rowType === 'income') {
                              deleteIncome(row.id);
                            } else if (row.rowType === 'transfer') {
                              deleteTransfer(row.id);
                            } else {
                              deleteExpense(row.id);
                            }
                          }}
                          className="text-stone-400 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                          title="Remove Transaction Entry"
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
        </div>
      </div>

      {/* ─── MODAL DIALOG FLOWS ─── */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5 pb-2 border-b border-stone-200/80">
                <h3 className="text-lg font-black tracking-tight text-stone-900 font-display flex items-center gap-2">
                  {activeModal === 'addIncome' && '🏦 Log Inbound Income'}
                  {activeModal === 'addExpense' && '🛒 Record Outbound Expense'}
                  {activeModal === 'fundTransfer' && '⇄ Log Account Transfer'}
                  {activeModal === 'settleCard' && '💳 Record Card Settlement'}
                </h3>
                <button onClick={() => setActiveModal(null)} className="text-stone-400 hover:text-stone-700">
                  <X size={18} />
                </button>
              </div>

              {/* 1. Add Income Modal */}
              {activeModal === 'addIncome' && (
                <form onSubmit={handleIncomeSubmit} className="space-y-4 text-xs font-semibold text-stone-700">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Source Description</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 focus:bg-stone-50 transition"
                      placeholder="e.g. Aiden Semi-Monthly paycheck"
                      value={incForm.desc}
                      onChange={e => setIncForm(prev => ({ ...prev, desc: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Amount (₱)</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        className="w-full text-xs font-black border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 text-right font-display text-emerald-800"
                        placeholder="₱ 0.00"
                        value={incForm.amount}
                        onChange={e => {
                          const val = e.target.value;
                          setIncForm(prev => ({ ...prev, amount: formatAsYouTypeHTML(val) }));
                        }}
                        onBlur={e => {
                          const num = parseMoney(e.target.value);
                          setIncForm(prev => ({ ...prev, amount: num > 0 ? formatPeso(num) : '' }));
                        }}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Transaction Date</label>
                      <input 
                        type="date" 
                        className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 font-display"
                        value={incForm.date}
                        onChange={e => setIncForm(prev => ({ ...prev, date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Inbound Deposit Destination</label>
                    <select 
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400"
                      value={incForm.via}
                      onChange={e => setIncForm(prev => ({ ...prev, via: e.target.value }))}
                      required
                    >
                      <option value="" disabled>Select cash asset target</option>
                      {state.cashAccounts.map(a => (
                        <option key={a.id} value={`cash:${a.id}`}>📂 Cash Pool: {a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Classification</label>
                      <select 
                        className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400"
                        value={incForm.type}
                        onChange={e => setIncForm(prev => ({ ...prev, type: e.target.value as any }))}
                      >
                        <option value="salary">Primary Base Salary</option>
                        <option value="additional">Alternative Consulting</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Resource Owner</label>
                      <select 
                        className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400"
                        value={incForm.earner}
                        onChange={e => setIncForm(prev => ({ ...prev, earner: e.target.value }))}
                      >
                        <option value="You">{state.partnerNames.you}</option>
                        <option value="Partner">{state.partnerNames.partner}</option>
                        <option value="Joint">Joint Asset Pooling</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t border-stone-200/80">
                    <button type="button" onClick={() => setActiveModal(null)} className="btn btn-ghost">Cancel</button>
                    <button type="submit" className="btn btn-primary bg-emerald-700 hover:bg-emerald-800">Record Inbound</button>
                  </div>
                </form>
              )}

              {/* 2. Add Expense Modal */}
              {activeModal === 'addExpense' && (
                <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs font-semibold text-stone-700">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Expense Identifier</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 focus:bg-stone-50 transition"
                      placeholder="e.g. S&R Groceries, Starbucks Date"
                      value={expForm.desc}
                      onChange={e => setExpForm(prev => ({ ...prev, desc: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Amount Paid (₱)</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        className="w-full text-xs font-black border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 text-right font-display text-red-800"
                        placeholder="₱ 0.00"
                        value={expForm.amount}
                        onChange={e => {
                          const val = e.target.value;
                          setExpForm(prev => ({ ...prev, amount: formatAsYouTypeHTML(val) }));
                        }}
                        onBlur={e => {
                          const num = parseMoney(e.target.value);
                          setExpForm(prev => ({ ...prev, amount: num > 0 ? formatPeso(num) : '' }));
                        }}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Transaction Date</label>
                      <input 
                        type="date" 
                        className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 font-display"
                        value={expForm.date}
                        onChange={e => setExpForm(prev => ({ ...prev, date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Budget Category Group</label>
                      <select 
                        className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400"
                        value={expForm.cat}
                        onChange={e => setExpForm(prev => ({ ...prev, cat: e.target.value }))}
                        required
                      >
                        {CATEGORIES.filter(c => c.v !== 'card_payment' && c.v !== 'amortization').map(c => (
                          <option key={c.v} value={c.v}>{c.i} {c.l}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Designated Earner</label>
                      <select 
                        className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400"
                        value={expForm.earner}
                        onChange={e => setExpForm(prev => ({ ...prev, earner: e.target.value }))}
                      >
                        <option value="Joint">Joint Asset Pooling</option>
                        <option value="You">{state.partnerNames.you}</option>
                        <option value="Partner">{state.partnerNames.partner}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Payment Vehicle (Source)</label>
                    <select 
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 font-display"
                      value={expForm.via}
                      onChange={e => setExpForm(prev => ({ ...prev, via: e.target.value }))}
                      required
                    >
                      <option value="" disabled>Select Payment Source Account</option>
                      {state.cashAccounts.length > 0 && (
                        <optgroup label="Cash on Hand Pool">
                          {state.cashAccounts.map(a => (
                            <option key={a.id} value={`cash:${a.id}`}>📂 {a.name} (Matched Cash)</option>
                          ))}
                        </optgroup>
                      )}
                      {state.cards.length > 0 && (
                        <optgroup label="Unsecured Credit Lines">
                          {state.cards.map(c => (
                            <option key={c.id} value={`card:${c.id}`}>💳 {c.name} ({c.bank})</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t border-stone-200/80">
                    <button type="button" onClick={() => setActiveModal(null)} className="btn btn-ghost">Cancel</button>
                    <button type="submit" className="btn btn-primary bg-stone-900 hover:bg-stone-800">Record Outbound</button>
                  </div>
                </form>
              )}

              {/* 3. Record internal Fund Transfer Modal */}
              {activeModal === 'fundTransfer' && (
                <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs font-semibold text-stone-700">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Transfer Description</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 focus:bg-stone-50 transition"
                      placeholder="e.g. GCash funding from Bank, Vault Savings stash"
                      value={transferForm.desc}
                      onChange={e => setTransferForm(prev => ({ ...prev, desc: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Capital Transferred (₱)</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        className="w-full text-xs font-black border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 text-right font-display text-indigo-800"
                        placeholder="₱ 0.00"
                        value={transferForm.amount}
                        onChange={e => {
                          const val = e.target.value;
                          setTransferForm(prev => ({ ...prev, amount: formatAsYouTypeHTML(val) }));
                        }}
                        onBlur={e => {
                          const num = parseMoney(e.target.value);
                          setTransferForm(prev => ({ ...prev, amount: num > 0 ? formatPeso(num) : '' }));
                        }}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Transfer Date</label>
                      <input 
                        type="date" 
                        className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 font-display"
                        value={transferForm.date}
                        onChange={e => setTransferForm(prev => ({ ...prev, date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Debit Source (From)</label>
                      <select 
                        className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400"
                        value={transferForm.fromId}
                        onChange={e => setTransferForm(prev => ({ ...prev, fromId: e.target.value }))}
                        required
                      >
                        <option value="" disabled>Select source cash pool</option>
                        {state.cashAccounts.map(a => (
                          <option key={a.id} value={a.id}>Deb: {a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Credit Dest (To)</label>
                      <select 
                        className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400"
                        value={transferForm.toId}
                        onChange={e => setTransferForm(prev => ({ ...prev, toId: e.target.value }))}
                        required
                      >
                        <option value="" disabled>Select dest cash pool</option>
                        {state.cashAccounts.map(a => (
                          <option key={a.id} value={a.id}>Cre: {a.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-[10px] text-stone-400 font-semibold leading-relaxed p-2.5 bg-stone-200/40 rounded-xl border border-stone-200">
                    💡 Internal transfers do not count towards expenses, budgets, savings rates, or incomes. They merely offset balances between asset pools.
                  </p>

                  <div className="flex gap-2 justify-end pt-4 border-t border-stone-200/80">
                    <button type="button" onClick={() => setActiveModal(null)} className="btn btn-ghost">Cancel</button>
                    <button type="submit" className="btn btn-primary bg-stone-900 hover:bg-stone-800">Dispatch Transfer</button>
                  </div>
                </form>
              )}

              {/* 4. Settle Card Modal */}
              {activeModal === 'settleCard' && (
                <form onSubmit={handleSettleSubmit} className="space-y-4 text-xs font-semibold text-stone-700">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Credit Instrument to Settle</label>
                    <select 
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400"
                      value={settleForm.cardId}
                      onChange={e => {
                        const val = e.target.value;
                        const cardObj = state.cards.find(c => c.id === val);
                        const owedAmt = cardObj ? getCardLastStatementDue(cardObj, state) : 0;
                        setSettleForm(prev => ({
                          ...prev,
                          cardId: val,
                          amount: owedAmt > 0 ? formatAsYouTypeHTML(owedAmt.toString()) : ''
                        }));
                      }}
                      required
                    >
                      <option value="" disabled>Select Credit Card Account</option>
                      {state.cards.map(c => (
                        <option key={c.id} value={c.id}>{c.name} · Statement Due: {formatPeso(getCardLastStatementDue(c, state))}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Liquidity Pool Debit Source (Paying From)</label>
                    <select 
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 font-display"
                      value={settleForm.via}
                      onChange={e => setSettleForm(prev => ({ ...prev, via: e.target.value }))}
                      required
                    >
                      <option value="" disabled>Select cash asset pool to debit</option>
                      {state.cashAccounts.map(a => (
                        <option key={a.id} value={`cash:${a.id}`}>📂 {a.name} (Matched Cash)</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Settlement Amount (₱)</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        className="w-full text-xs font-black border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 text-right font-display text-emerald-800"
                        placeholder="₱ 0.00"
                        value={settleForm.amount}
                        onChange={e => {
                          const val = e.target.value;
                          setSettleForm(prev => ({ ...prev, amount: formatAsYouTypeHTML(val) }));
                        }}
                        onBlur={e => {
                          const num = parseMoney(e.target.value);
                          setSettleForm(prev => ({ ...prev, amount: num > 0 ? formatPeso(num) : '' }));
                        }}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Payment Date</label>
                      <input 
                        type="date" 
                        className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 font-display"
                        value={settleForm.date}
                        onChange={e => setSettleForm(prev => ({ ...prev, date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Notes / Reference</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 focus:bg-stone-50 transition"
                      placeholder="e.g. Paid BPI statement fully"
                      value={settleForm.notes}
                      onChange={e => setSettleForm(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t border-stone-200/80">
                    <button type="button" onClick={() => setActiveModal(null)} className="btn btn-ghost">Cancel</button>
                    <button type="submit" className="btn btn-primary bg-emerald-700 hover:bg-emerald-800">Dispatch Settlement</button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
