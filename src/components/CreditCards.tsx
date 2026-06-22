/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard as CardIcon, 
  Trash2, 
  Eye, 
  Coins, 
  ShieldAlert, 
  CalendarDays, 
  HelpCircle,
  PlusCircle,
  X 
} from 'lucide-react';
import { GlobalState, CreditCard, Expense, Amortization } from '../types';
import { 
  formatPeso, 
  getCardDueInfo, 
  getStatementCycleForDate, 
  formatDisplayDate, 
  getCategoryInfo,
  parseMoney,
  CASH_COLORS,
  today,
  getCardLastStatementDue,
  formatAsYouTypeHTML
} from '../utils';

interface CreditCardsProps {
  state: GlobalState;
  addCard: (name: string, bank: string, limit: number, cutDay: number, dueDay: number, initialStatement?: number) => void;
  deleteCard: (id: string) => void;
  triggerSettleCard: (cardId: string) => void;
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
}

export default function CreditCards({
  state,
  addCard,
  deleteCard,
  triggerSettleCard,
  activeModal,
  setActiveModal
}: CreditCardsProps) {
  // SOA Details Modal state
  const [selectedSoaCard, setSelectedSoaCard] = useState<CreditCard | null>(null);

  // Form state
  const [cardName, setCardName] = useState('');
  const [cardBank, setCardBank] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  const [cardCut, setCardCut] = useState('5');
  const [cardDue, setCardDue] = useState('25');
  const [cardInitialStatement, setCardInitialStatement] = useState('');

  // Calculates total outstanding charges from expenses and auto-charges on a specific card
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
        return sum + (item.monthlyAmount); // Simple approximation of active due
      }, 0);

    const totalSettled = state.expenses
      .filter(e => e.type === 'card_payment' && e.cardPaymentCardId === cardId)
      .reduce((sum, e) => sum + e.amount, 0);

    const transfersIntoCard = state.transfers
      .filter(t => t.toCashAccountId === cardId)
      .reduce((sum, t) => sum + t.amount, 0);

    const transfersOutOfCard = state.transfers
      .filter(t => t.fromCashAccountId === cardId)
      .reduce((sum, t) => sum + t.amount, 0);

    return Math.max(0, manualOutstanding + itemizedCharges + recurringCharges + transfersOutOfCard - totalSettled - transfersIntoCard);
  };

  // Get list of transactions logged on card
  const getCardExpenseRows = (card: CreditCard) => {
    const logged = state.expenses
      .filter(e => e.paymentSourceType === 'card' && e.paymentSourceId === card.id && e.type !== 'card_payment')
      .map(e => ({
        ...e,
        cycle: getStatementCycleForDate(card, e.date),
        catInfo: getCategoryInfo(e.cat),
        isVirtualRecam: false
      }));

    // Auto recurring amortization charges
    const recurring = state.amortizations
      .filter(a => a.recurringCardId === card.id)
      .map(a => {
        // approximate charges for standard periods
        return {
          id: `recam_${a.id}`,
          desc: `${a.name} Recur Charge`,
          amount: a.monthlyAmount,
          date: today().substring(0, 8) + '15',
          cat: 'amortization',
          via: card.name,
          paymentSourceType: 'card' as 'card',
          paymentSourceId: card.id,
          earner: 'Joint',
          cycle: getStatementCycleForDate(card, today().substring(0, 8) + '15'),
          catInfo: getCategoryInfo('amortization'),
          isVirtualRecam: true
        };
      });

    return [...logged, ...recurring].sort((a, b) => b.date.localeCompare(a.date));
  };

  // Organize expenses into statements grouped by monthly cycles
  const getStatementGroups = (card: CreditCard) => {
    const expenses = getCardExpenseRows(card);
    const groups: { [key: string]: { cycle: any; rows: any[]; total: number } } = {};

    expenses.forEach(row => {
      const gKey = row.cycle.key;
      if (!groups[gKey]) {
        groups[gKey] = {
          cycle: row.cycle,
          rows: [],
          total: 0
        };
      }
      groups[gKey].rows.push(row);
      groups[gKey].total += row.amount;
    });

    return Object.values(groups).sort((a, b) => b.cycle.statementDate.getTime() - a.cycle.statementDate.getTime());
  };

  const getSettleLogs = (cardId: string) => {
    return state.expenses
      .filter(e => e.type === 'card_payment' && e.cardPaymentCardId === cardId)
      .sort((a,b) => b.date.localeCompare(a.date));
  };

  // Determine nearest payment due
  const getNearestDueCard = () => {
    const cardsWithOwed = state.cards
      .map(c => ({
        ...c,
        owed: getCardOwedTotal(c.id),
        dueInfo: getCardDueInfo(c.dueDay)
      }))
      .filter(c => c.owed > 0);

    if (cardsWithOwed.length === 0) return null;
    return cardsWithOwed.sort((a, b) => a.dueInfo.days - b.dueInfo.days)[0];
  };

  const nearestDue = getNearestDueCard();

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseMoney(cardLimit);
    const cut = parseInt(cardCut) || 5;
    const due = parseInt(cardDue) || 25;
    const initialStatement = parseMoney(cardInitialStatement);

    if (!cardName.trim() || limit <= 0) return;
    addCard(cardName.trim(), cardBank.trim() || 'Issuer bank', limit, cut, due, initialStatement);

    setCardName('');
    setCardBank('');
    setCardLimit('');
    setCardCut('5');
    setCardDue('25');
    setCardInitialStatement('');
    setActiveModal(null);
  };

  return (
    <div className="space-y-6">
      {/* Upper toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black font-display text-stone-900 tracking-tight">Credit Portfolio</h1>
          <p className="text-stone-500 font-semibold text-xs mt-0.5">Track, control, and structure outstanding balances, cutoff periods, and credit limits</p>
        </div>
        <button 
          onClick={() => setActiveModal('addCard')}
          className="bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition font-display inline-flex items-center gap-1.5 self-start md:self-auto"
        >
          <CardIcon size={14} /> Add Credit Card
        </button>
      </div>

      {/* Nearest due highlights */}
      {nearestDue && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-700 font-display">Nearest Owed Dues Incoming</span>
            <h4 className="text-xl font-black text-stone-900 font-display mt-1">{nearestDue.name}</h4>
            <div className="text-xs text-stone-500 font-bold mt-1.5 flex items-center gap-2">
              <CalendarDays size={13} className="text-amber-600" />
              <span>{nearestDue.bank} — {nearestDue.dueInfo.label} ({nearestDue.dueInfo.dateLabel})</span>
            </div>
          </div>
          <div className="text-left md:text-right">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 font-display">Calculated Due</span>
            <div className="text-2xl font-black text-red-700 font-display mt-0.5">{formatPeso(nearestDue.owed)}</div>
            <p className="text-[10px] text-stone-400 font-semibold mt-1">Sum of outstanding balance + dynamic card transactions</p>
          </div>
        </div>
      )}

      {/* Credit Instrument Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {state.cards.map(card => {
          const owedAmt = getCardOwedTotal(card.id);
          const limit = card.limit;
          const utilizationRate = limit > 0 ? Math.min(Math.round((owedAmt / limit) * 100), 100) : 0;
          const dueInfo = getCardDueInfo(card.dueDay);
          const isNearest = nearestDue && nearestDue.id === card.id;

          const cardThemeColor = card.color || '#6B7280';

          return (
            <div 
              key={card.id}
              className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col justify-between space-y-6 relative"
            >
              {/* Colored Card edge indicator */}
              <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: cardThemeColor }}></div>

              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black font-display text-stone-900 tracking-tight">{card.name}</h3>
                    {isNearest && (
                      <span className="bg-amber-100 border border-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded-md text-[9px] font-display">
                        ⚠️ NEAREST DUE
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-stone-400 font-extrabold uppercase tracking-wider font-display">{card.bank}</span>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Delete this credit instrument? Any expenses matched to this card will lose their card tag.')) {
                      deleteCard(card.id);
                    }
                  }}
                  className="text-stone-300 hover:text-red-600 transition p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Utilization index */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold text-stone-500">
                  <span>Credit Utilization</span>
                  <span className="font-bold">{utilizationRate}%</span>
                </div>
                <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all" 
                    style={{ 
                      width: `${utilizationRate}%`, 
                      backgroundColor: cardThemeColor
                    }}
                  ></div>
                </div>
              </div>

              {/* Dynamic stats detail */}
              <div className="grid grid-cols-2 gap-4 bg-stone-100/50 rounded-2xl p-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Assigned Limit</span>
                  <strong className="text-sm font-extrabold text-stone-800 font-display">{formatPeso(limit, 0)}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block mb-0.5">Last Statement Due</span>
                  <strong className="text-sm font-black text-rose-950 font-display">{formatPeso(getCardLastStatementDue(card, state))}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Current Balance Due</span>
                  <strong className="text-sm font-extrabold text-red-700 font-display">{formatPeso(owedAmt)}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Statement Closing</span>
                  <span className="font-bold text-stone-700 font-display">Day {card.cutDay}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Payment Due Day</span>
                  <span className="font-bold text-stone-700 font-display">Day {card.dueDay}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Due Horizon</span>
                  <span className="font-bold text-stone-700 font-display truncate block">{dueInfo.label}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200/50">
                <button
                  onClick={() => triggerSettleCard(card.id)}
                  className="bg-stone-50 hover:bg-stone-250 border border-stone-300 text-stone-700 hover:text-stone-900 font-bold text-xs px-3.5 py-2 rounded-xl transition inline-flex items-center gap-1 font-display shadow-sm"
                >
                  <Coins size={12} /> Settle Due
                </button>
                <button
                  onClick={() => setSelectedSoaCard(card)}
                  className="bg-stone-900 hover:bg-stone-800 text-stone-50 font-bold text-xs px-3.5 py-2 rounded-xl transition inline-flex items-center gap-1 font-display shadow-sm"
                >
                  <Eye size={12} /> View Card SOA
                </button>
              </div>
            </div>
          );
        })}

        {state.cards.length === 0 && (
          <div className="col-span-1 md:col-span-2 text-center py-16 border border-dashed border-stone-300 rounded-3xl bg-stone-50/50">
            <span className="text-3xl">💳</span>
            <h4 className="text-stone-800 font-black text-sm font-display mt-2">No Credit Lines Added</h4>
            <p className="text-stone-400 text-xs font-semibold mt-1 max-w-sm mx-auto">
              Add your household credit cards here to track active cycle utilization, cutoff closures, and full payment statements.
            </p>
            <button 
              onClick={() => setActiveModal('addCard')}
              className="mt-4 bg-stone-900 text-xs text-stone-100 hover:bg-stone-850 px-4 py-2 font-bold rounded-xl transition"
            >
              Add First Credit Instrument
            </button>
          </div>
        )}
      </div>

      {/* ─── MODAL DIALOGS ─── */}
      <AnimatePresence>
        {/* 1. Add Credit Card Modal */}
        {activeModal === 'addCard' && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5 pb-2 border-b border-stone-200/80">
                <h3 className="text-lg font-black tracking-tight text-stone-900 font-display flex items-center gap-1.5">
                  💳 Add Credit Instrument
                </h3>
                <button onClick={() => setActiveModal(null)} className="text-stone-400 hover:text-stone-700">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateCard} className="space-y-4 text-xs font-semibold text-stone-700">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Card Identifier / Name</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 focus:bg-stone-50 transition"
                    placeholder="e.g. Card Platinum Cashback, Miles Card"
                    value={cardName}
                    onChange={e => setCardName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Issuing Institutional Bank</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 focus:bg-stone-50 transition"
                    placeholder="e.g. BPI, BDO, UnionBank"
                    value={cardBank}
                    onChange={e => setCardBank(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Absolute Credit Limit (₱)</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    className="w-full text-xs font-black border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 text-right font-display text-emerald-800"
                    placeholder="₱ 100,000.00"
                    value={cardLimit}
                    onChange={e => setCardLimit(formatAsYouTypeHTML(e.target.value))}
                    onBlur={e => {
                      const num = parseMoney(e.target.value);
                      setCardLimit(num > 0 ? formatPeso(num) : '');
                    }}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Starting Last Statement Due (₱)</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    className="w-full text-xs font-black border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 text-right font-display text-emerald-800"
                    placeholder="₱ 0.00"
                    value={cardInitialStatement}
                    onChange={e => setCardInitialStatement(formatAsYouTypeHTML(e.target.value))}
                    onBlur={e => {
                      const num = parseMoney(e.target.value);
                      setCardInitialStatement(num > 0 ? formatPeso(num) : '');
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Statement Closing Cutoff Day</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="31"
                      className="w-full text-xs font-black border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 font-display"
                      placeholder="e.g. 5"
                      value={cardCut}
                      onChange={e => setCardCut(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Settlement Due Calendar Day</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="31"
                      className="w-full text-xs font-black border border-stone-200 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 font-display"
                      placeholder="e.g. 25"
                      value={cardDue}
                      onChange={e => setCardDue(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-stone-200/80">
                  <button type="button" onClick={() => setActiveModal(null)} className="btn btn-ghost">Cancel</button>
                  <button type="submit" className="btn btn-primary bg-stone-900 hover:bg-stone-850">Establish Card Profile</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 2. Interactive SOA Detail Modal */}
        {selectedSoaCard && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-black font-display text-stone-900 tracking-tight">
                    {selectedSoaCard.name} — Detailed Statement of Account
                  </h3>
                  <p className="text-xs text-stone-400 font-bold mt-0.5">
                    Statement cutoff cycle organizing. Settlement checks deduct immediately.
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedSoaCard(null)} 
                  className="text-stone-400 hover:text-stone-700 font-bold text-xl leading-none"
                >
                  &times;
                </button>
              </div>

              {/* SOA Summary Header card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-stone-100/70 rounded-2xl p-4.5 text-xs mb-6 border border-stone-200/55">
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Calculated Card Owed</span>
                  <strong className="text-xl font-black font-display text-red-800">{formatPeso(getCardOwedTotal(selectedSoaCard.id))}</strong>
                  <p className="text-[9px] text-stone-400 font-semibold mt-1">Outstanding less all logged settlements</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Outstanding Balance Carried</span>
                  <strong className="text-xl font-black font-display text-stone-700">{formatPeso(selectedSoaCard.outstandingBalance)}</strong>
                  <p className="text-[9px] text-stone-400 font-semibold mt-1">Base outstanding defined on profile</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Total Line Payments</span>
                  <strong className="text-xl font-black font-display text-emerald-800">
                    {formatPeso(getSettleLogs(selectedSoaCard.id).reduce((sum, item) => sum + item.amount, 0))}
                  </strong>
                  <p className="text-[9px] text-stone-400 font-semibold mt-1">Matched payouts from cash liquid accounts</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* 1. Cycles representation */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-stone-500 font-display tracking-widest pb-1.5 border-b border-stone-200">
                    Statement Cutoff Cycle Groups
                  </h4>

                  {getStatementGroups(selectedSoaCard).length === 0 ? (
                    <div className="text-center py-6 text-stone-400 text-xs italic font-semibold italic border border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
                      No card-funded dynamic expense records logged for this credit line.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {getStatementGroups(selectedSoaCard).map(group => {
                        const isPast = group.cycle.status.includes('Past');
                        return (
                          <div 
                            key={group.cycle.key} 
                            className={`border rounded-2xl p-4 shadow-sm bg-stone-50/50 ${isPast ? 'border-red-200' : 'border-stone-200'}`}
                          >
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 pb-2 border-b border-stone-100">
                              <div>
                                <h5 className="font-extrabold text-stone-900 text-xs md:text-sm font-display">
                                  Statement Cutoff: {group.cycle.statementLabel}
                                </h5>
                                <p className="text-[10px] text-stone-400 font-semibold mt-0.5">
                                  Cycle span: {group.cycle.cycleLabel} · Settles by: <span className="font-bold text-stone-600">{group.cycle.dueLabel}</span>
                                </p>
                              </div>
                              <div className="sm:text-right">
                                <span className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase font-display block w-fit sm:ml-auto mb-1 ${
                                  isPast ? 'bg-red-100 text-red-800' : 'bg-stone-200 text-stone-700'
                                }`}>
                                  {group.cycle.status}
                                </span>
                                <div className="text-xs font-black text-rose-800">
                                  SOA segment total: {formatPeso(group.total)}
                                </div>
                              </div>
                            </div>

                            {/* Cycle item records */}
                            <div className="pt-2 divide-y divide-stone-100 space-y-2">
                              {group.rows.map(item => (
                                <div key={item.id} className="pt-2 flex justify-between items-center text-xs">
                                  <div>
                                    <div className="font-extrabold text-stone-800">
                                      {item.desc}
                                      {item.isVirtualRecam && (
                                        <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-700">
                                          Auto Amort
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-stone-400 font-semibold mt-0.5">
                                      {formatDisplayDate(item.date)} · Category: {item.catInfo?.i} {item.catInfo?.l}
                                    </div>
                                  </div>
                                  <span className="font-black text-red-700">{formatPeso(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Settle History checks on Card */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-stone-500 font-display tracking-widest pb-1.5 border-b border-stone-200">
                    Line Settlement Logs
                  </h4>
                  {getSettleLogs(selectedSoaCard.id).length === 0 ? (
                    <div className="text-center py-6 text-stone-400 text-xs italic font-semibold italic border border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
                      No matching settlement checks registered to date.
                    </div>
                  ) : (
                    <div className="space-y-2 bg-stone-100 p-3.5 rounded-2xl divide-y divide-stone-200/50">
                      {getSettleLogs(selectedSoaCard.id).map(log => (
                        <div key={log.id} className="pt-2 flex justify-between items-center text-xs first:pt-0">
                          <div>
                            <div className="font-extrabold text-stone-800">{log.desc}</div>
                            <div className="text-[10px] text-stone-400 font-semibold mt-0.5">
                              {formatDisplayDate(log.date)} · Deducted from {log.via}
                            </div>
                          </div>
                          <span className="font-black text-emerald-800">{formatPeso(log.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-2.5 pt-4 border-t border-stone-250">
                <button
                  onClick={() => {
                    const cardRef = selectedSoaCard.id;
                    setSelectedSoaCard(null);
                    triggerSettleCard(cardRef);
                  }}
                  className="bg-stone-900 border border-stone-900 text-stone-50 hover:bg-stone-850 font-bold text-xs px-4 py-2 rounded-xl transition inline-flex items-center gap-1 font-display shadow-sm"
                >
                  <Coins size={12} /> Settle This Card
                </button>
                <button 
                  onClick={() => setSelectedSoaCard(null)}
                  className="bg-stone-100 border border-stone-300 text-stone-700 hover:text-stone-900 text-xs font-bold px-4 py-2 rounded-xl transition"
                >
                  Close Document
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
