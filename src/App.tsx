/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Wallet, 
  CreditCard as CardIcon, 
  PieChart, 
  Users, 
  Download, 
  Upload, 
  CheckCircle,
  Menu,
  X,
  Lock,
  LogOut
} from 'lucide-react';
import { GlobalState, ReceivedIncome, Expense, FundTransfer, CreditCard, Budget, Amortization, PartnerDeductions } from './types';
import { INITIAL_STATE, formatPeso, today, getMonthKey, parseMoney, CASH_COLORS, formatAsYouTypeHTML } from './utils';
import Overview from './components/Overview';
import Transactions from './components/Transactions';
import CreditCards from './components/CreditCards';
import BudgetStrategy from './components/BudgetStrategy';
import IncomeAnalysis from './components/IncomeAnalysis';
import Login, { AVATAR_PRESETS } from './components/Login';
import { supabase, SUPABASE_TABLE, SUPABASE_DOC_ID } from './supabase';
import SupabaseSync from './components/SupabaseSync';

// Helper to render partner avatar elegantly
const renderPartnerAvatarInApp = (pic?: string, name?: string, sizeClass: string = "w-10 h-10 text-md") => {
  const isUrl = pic && (pic.startsWith('http') || pic.startsWith('data:image'));
  if (isUrl) {
    return (
      <img 
        src={pic} 
        alt={name} 
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-full object-cover border-2 border-stone-300 shadow-sm shrink-0`} 
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

export default function App() {
  // ─── AUTHENTICATION STATE ───
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('dink_finance_unlocked') === 'true';
  });
  const [user, setUser] = useState<any>(null);

  // ─── PROFILE EDIT MODAL STATES ───
  const [editYouName, setEditYouName] = useState('');
  const [editPartnerName, setEditPartnerName] = useState('');
  const [editYouPic, setEditYouPic] = useState('av_man1');
  const [editPartnerPic, setEditPartnerPic] = useState('av_woman1');
  const [editYouCustomUrl, setEditYouCustomUrl] = useState('');
  const [editPartnerCustomUrl, setEditPartnerCustomUrl] = useState('');
  const [showEditYouCustom, setShowEditYouCustom] = useState(false);
  const [showEditPartnerCustom, setShowEditPartnerCustom] = useState(false);

  // Submit profile edit changes
  const saveUpdatedProfiles = async () => {
    const finalYouPic = showEditYouCustom ? editYouCustomUrl.trim() : editYouPic;
    const finalPartnerPic = showEditPartnerCustom ? editPartnerCustomUrl.trim() : editPartnerPic;

    const updated = {
      you: editYouName.trim() || 'Aiden',
      partner: editPartnerName.trim() || 'Chloe',
      youPic: finalYouPic || 'av_man1',
      partnerPic: finalPartnerPic || 'av_woman1'
    };

    setState(prev => ({
      ...prev,
      partnerNames: updated
    }));

    // Save to user metadata in active Supabase Auth too!
    if (supabase && user) {
      try {
        await supabase.auth.updateUser({
          data: { partnerNames: updated }
        });
      } catch (e) {
        console.warn('Could not sync update to auth metadata, state table will still save:', e);
      }
    }

    setActiveModal(null);
  };

  // ─── LOCAL STORAGE PERSISTENCE ───
  const [state, setState] = useState<GlobalState>(() => {
    const saved = localStorage.getItem('dink_finance_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Guarantee schema consistency
        if (!parsed.transfers) parsed.transfers = [];
        if (!parsed.monthlyBudgets) parsed.monthlyBudgets = {};
        if (!parsed.cashAccounts) parsed.cashAccounts = [];
        return parsed;
      } catch (e) {
        console.error('Error re-vamping local storage state', e);
      }
    }
    return INITIAL_STATE;
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'credit' | 'budget' | 'analysis'>('overview');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [settleCardId, setSettleCardId] = useState<string>('');
  
  // Mobile responsive sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync state mutations to local storage
  useEffect(() => {
    localStorage.setItem('dink_finance_state', JSON.stringify(state));
  }, [state]);

  // ─── SUPABASE CLOUD PERSISTENCE ───
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'unconfigured' | 'relation_missing'>(() => {
    return supabase ? 'idle' : 'unconfigured';
  });

  const getDocId = (currentUser = user) => {
    return currentUser ? `user_${currentUser.id}` : SUPABASE_DOC_ID;
  };

  const fetchFromSupabase = async (targetUser = user) => {
    if (!supabase) return;
    setSyncStatus('loading');
    const docId = getDocId(targetUser);
    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLE)
        .select('state')
        .eq('id', docId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Record not found (table exists but vacant), let's push local state as initial
          const { error: upsertError } = await supabase
            .from(SUPABASE_TABLE)
            .upsert({ id: docId, state: state, updated_at: new Date().toISOString() });
          if (upsertError) throw upsertError;
          setSyncStatus('synced');
        } else {
          throw error;
        }
      } else if (data && data.state) {
        // Load remote state and preserve schema integrity
        const parsed = data.state;
        if (!parsed.transfers) parsed.transfers = [];
        if (!parsed.monthlyBudgets) parsed.monthlyBudgets = {};
        if (!parsed.cashAccounts) parsed.cashAccounts = [];
        setState(parsed);
        setSyncStatus('synced');
      }
    } catch (err: any) {
      console.error('Supabase fetch error:', err);
      if (err.message?.includes('relation') || err.message?.includes('does not exist')) {
        setSyncStatus('relation_missing');
      } else {
        setSyncStatus('error');
      }
    }
  };

  const saveToSupabase = async (currentState: GlobalState, targetUser = user) => {
    if (!supabase) return;
    setSyncStatus('saving');
    const docId = getDocId(targetUser);
    try {
      const { error } = await supabase
        .from(SUPABASE_TABLE)
        .upsert({
          id: docId,
          state: currentState,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      setSyncStatus('synced');
    } catch (err: any) {
      console.error('Supabase save error:', err);
      if (err.message?.includes('relation') || err.message?.includes('does not exist')) {
        setSyncStatus('relation_missing');
      } else {
        setSyncStatus('error');
      }
    }
  };

  // ─── AUTHENTIC SESSION SYNCHRONIZER ───
  useEffect(() => {
    if (!supabase) return;

    // Direct check active session on loading
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setIsUnlocked(true);
        sessionStorage.setItem('dink_finance_unlocked', 'true');
        // Initial fetch with active session on reload
        fetchFromSupabase(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        setIsUnlocked(true);
        sessionStorage.setItem('dink_finance_unlocked', 'true');
        fetchFromSupabase(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Pull on startup
  useEffect(() => {
    if (isUnlocked && supabase) {
      fetchFromSupabase(user);
    }
  }, [isUnlocked]);

  // Debounced auto-save on state mutation
  useEffect(() => {
    if (!isUnlocked || !supabase || syncStatus === 'loading') return;

    const timer = setTimeout(() => {
      saveToSupabase(state, user);
    }, 2000);

    return () => clearTimeout(timer);
  }, [state, isUnlocked, user]);

  const handleLogActiveSessionOut = async () => {
    sessionStorage.removeItem('dink_finance_unlocked');
    setIsUnlocked(false);
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  // Dynamic Cash Pool balances total
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

  // ─── STATE MUTATIONS DISPATCHERS ───
  const addIncome = (
    desc: string, 
    amount: number, 
    date: string, 
    viaStr: string, 
    paymentSourceId: string, 
    earner: string, 
    type: 'salary' | 'additional'
  ) => {
    const newInc: ReceivedIncome = {
      id: `inc_${Date.now()}`,
      desc,
      amount,
      date,
      via: viaStr.startsWith('cash:') ? (state.cashAccounts.find(a => a.id === paymentSourceId)?.name || 'Cash Asset') : viaStr,
      paymentSourceType: 'cash',
      paymentSourceId,
      earner,
      type
    };

    setState(prev => ({
      ...prev,
      receivedIncome: [...prev.receivedIncome, newInc]
    }));
  };

  const addExpense = (
    desc: string, 
    amount: number, 
    date: string, 
    cat: string, 
    viaStr: string, 
    paymentSourceType: 'cash' | 'card', 
    paymentSourceId: string, 
    earner: string
  ) => {
    const solvedVia = paymentSourceType === 'cash'
      ? (state.cashAccounts.find(a => a.id === paymentSourceId)?.name || 'Cash Pool')
      : (state.cards.find(c => c.id === paymentSourceId)?.name || 'Credit card');

    const newExp: Expense = {
      id: `exp_${Date.now()}`,
      desc,
      amount,
      date,
      cat,
      via: solvedVia,
      paymentSourceType,
      paymentSourceId,
      earner
    };

    // If settling a card specifically, append card payment properties
    if (cat === 'card_payment') {
      newExp.type = 'card_payment';
      newExp.cardPaymentCardId = settleCardId || (state.cards[0]?.id || '');
    }

    setState(prev => ({
      ...prev,
      expenses: [...prev.expenses, newExp]
    }));
  };

  const addTransfer = (desc: string, amount: number, date: string, fromId: string, toId: string) => {
    const newTransfer: FundTransfer = {
      id: `tr_${Date.now()}`,
      type: 'fund_transfer',
      desc: desc || 'Internal Cash Transfer',
      amount,
      date,
      fromCashAccountId: fromId,
      toCashAccountId: toId
    };

    setState(prev => ({
      ...prev,
      transfers: [...prev.transfers, newTransfer]
    }));
  };

  const deleteIncome = (id: string) => {
    setState(prev => ({
      ...prev,
      receivedIncome: prev.receivedIncome.filter(i => i.id !== id)
    }));
  };

  const deleteExpense = (id: string) => {
    setState(prev => ({
      ...prev,
      expenses: prev.expenses.filter(e => e.id !== id)
    }));
  };

  const deleteTransfer = (id: string) => {
    setState(prev => ({
      ...prev,
      transfers: prev.transfers.filter(t => t.id !== id)
    }));
  };

  const updateIncome = (id: string, updated: Partial<ReceivedIncome>) => {
    setState(prev => ({
      ...prev,
      receivedIncome: prev.receivedIncome.map(i => i.id === id ? { ...i, ...updated } : i)
    }));
  };

  const updateExpense = (id: string, updated: Partial<Expense>) => {
    setState(prev => ({
      ...prev,
      expenses: prev.expenses.map(e => e.id === id ? { ...e, ...updated } : e)
    }));
  };

  const updateTransfer = (id: string, updated: Partial<FundTransfer>) => {
    setState(prev => ({
      ...prev,
      transfers: prev.transfers.map(t => t.id === id ? { ...t, ...updated } : t)
    }));
  };

  const addCard = (name: string, bank: string, limit: number, cutDay: number, dueDay: number, initialStatement: number = 0) => {
    // Basic color selection
    const colors = ['#D94F4F', '#C2740A', '#4F54D4', '#0D9E80', '#A150D4'];
    const colorSelected = colors[state.cards.length % colors.length];

    const newCard: CreditCard = {
      id: `cc_${Date.now()}`,
      name,
      bank,
      limit,
      statementBalance: initialStatement,
      outstandingBalance: initialStatement,
      cutDay,
      dueDay,
      color: colorSelected
    };

    setState(prev => ({
      ...prev,
      cards: [...prev.cards, newCard]
    }));
  };

  const deleteCard = (id: string) => {
    setState(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== id),
      // Clean target allocations to default unassigned
      expenses: prev.expenses.map(e => e.paymentSourceType === 'card' && e.paymentSourceId === id ? { ...e, paymentSourceType: 'manual', paymentSourceId: '', via: 'N/A' } : e)
    }));
  };

  const addBudget = (cat: string, limit: number) => {
    const listLabels: { [key: string]: string } = {
      food: 'Food & Groceries',
      dining: 'Dining Out',
      transport: 'Transport / Fuel',
      utilities: 'Utilities',
      rent: 'Rent & Housing',
      health: 'Health & Wellness',
      fitness: 'Gym & Fitness',
      travel: 'Travel & Vacations',
      entertainment: 'Entertainment',
      shopping: 'Shopping',
      date: 'Date Nights',
      home: 'Home Improvement',
      savings: 'Savings & Investments',
      load: 'Mobile & Internet',
      pets: 'Pets',
      other: 'Other'
    };
    const listIcons: { [key: string]: string } = {
      food: '🛒', dining: '🍽️', transport: '🚗', utilities: '💡', rent: '🏠',
      health: '🏥', fitness: '💪', travel: '✈️', entertainment: '🎬', shopping: '🛍️',
      date: '🌙', home: '🔧', savings: '🏦', load: '📱', pets: '🐾', other: '📌',
      amortization: '🧾', card_payment: '💳'
    };

    const newBgt: Budget = {
      id: `bgt_${Date.now()}`,
      cat,
      label: listLabels[cat] || 'Other',
      icon: listIcons[cat] || '📌',
      limit
    };

    setState(prev => ({
      ...prev,
      budgets: [...prev.budgets, newBgt]
    }));
  };

  const deleteBudget = (id: string) => {
    setState(prev => ({
      ...prev,
      budgets: prev.budgets.filter(b => b.id !== id)
    }));
  };

  const updateBudgetLimit = (id: string, limit: number, monthKey: string) => {
    setState(prev => {
      const bMap = { ...prev.monthlyBudgets };
      if (!bMap[monthKey]) bMap[monthKey] = {};
      bMap[monthKey][id] = limit;

      return {
        ...prev,
        monthlyBudgets: bMap,
        budgets: prev.budgets.map(b => b.id === id ? { ...b, limit } : b)
      };
    });
  };

  const addAmortization = (name: string, cat: string, amount: number, start: string, term: number, recurringCardId: string) => {
    const newAmort: Amortization = {
      id: `am_${Date.now()}`,
      name,
      cat,
      monthlyAmount: amount,
      startDate: start,
      termMonths: term,
      recurringCardId
    };

    setState(prev => ({
      ...prev,
      amortizations: [...prev.amortizations, newAmort]
    }));
  };

  const deleteAmortization = (id: string) => {
    setState(prev => ({
      ...prev,
      amortizations: prev.amortizations.filter(a => a.id !== id)
    }));
  };

  const updateSalary = (earner: 'you' | 'partner', val: number) => {
    setState(prev => ({
      ...prev,
      salaries: {
        ...prev.salaries,
        [earner]: val
      }
    }));
  };

  const updateDeductions = (earner: 'you' | 'partner', field: keyof PartnerDeductions, val: number) => {
    setState(prev => ({
      ...prev,
      deductions: {
        ...prev.deductions,
        [earner]: {
          ...prev.deductions[earner],
          [field]: val
        }
      }
    }));
  };

  const addIncomeSource = (desc: string, expectedAmt: number, earner: 'you' | 'partner') => {
    const newSource = {
      id: `src_${Date.now()}`,
      desc,
      expectedAmt,
      earner
    };

    setState(prev => ({
      ...prev,
      incomeSources: [...prev.incomeSources, newSource]
    }));
  };

  const deleteIncomeSource = (id: string) => {
    setState(prev => ({
      ...prev,
      incomeSources: prev.incomeSources.filter(s => s.id !== id)
    }));
  };

  const deleteCashAccount = (id: string) => {
    setState(prev => ({
      ...prev,
      cashAccounts: prev.cashAccounts.filter(a => a.id !== id)
    }));
  };

  // Adjust savings goal
  const [targetValInput, setTargetValInput] = useState('');
  const submitSavingsTargetValue = (val: string) => {
    const num = parseMoney(val);
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        monthlySavingsTarget: num
      }
    }));
    setActiveModal(null);
  };

  // Add Cash Account
  const [newCashPoolName, setNewCashPoolName] = useState('');
  const [newCashPoolColor, setNewCashPoolColor] = useState('#0D9E80');
  const submitNewCashPool = () => {
    if (!newCashPoolName.trim()) return;
    const newAcc = {
      id: `ca_${Date.now()}`,
      name: newCashPoolName.trim(),
      color: newCashPoolColor
    };
    setState(prev => ({
      ...prev,
      cashAccounts: [...prev.cashAccounts, newAcc]
    }));
    setNewCashPoolName('');
    setActiveModal(null);
  };

  // ─── EXPORT / IMPORT BACKUPS ───
  const exportBackup = () => {
    const payload = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dink-finance-backup-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string);
        // Schema checks
        if (imported.partnerNames && Array.isArray(imported.receivedIncome) && Array.isArray(imported.expenses)) {
          setState(imported);
          alert('Financial backup imported successfully and synched in storage.');
        } else {
          alert('Import failed. Invalid file schema.');
        }
      } catch (err) {
        alert('Could not parse imported JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const [budgetMonth, setBudgetMonth] = useState('current');

  if (!isUnlocked) {
    return (
      <Login 
        partnerNames={state.partnerNames} 
        onUnlock={(partnerData) => { 
          setIsUnlocked(true); 
          sessionStorage.setItem('dink_finance_unlocked', 'true'); 
          if (partnerData) {
            setState(prev => ({
              ...prev,
              partnerNames: {
                you: partnerData.you,
                partner: partnerData.partner,
                youPic: partnerData.youPic,
                partnerPic: partnerData.partnerPic
              }
            }));
          }
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] text-stone-900 flex flex-col md:flex-row font-sans selection:bg-stone-300 selection:text-stone-900">
      
      {/* MOBILE HEADER TOOLBAR */}
      <div className="md:hidden bg-[#EAE4D8] border-b border-stone-300/70 p-4 sticky top-0 z-40 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-indigo-600 flex items-center justify-center font-bold text-white text-md font-display">
            ₱
          </div>
          <div>
            <h1 className="font-extrabold font-display text-sm tracking-tight">Finance Tracker</h1>
            <p className="text-[10px] text-stone-500 font-bold uppercase leading-none font-display">DINK Engine</p>
          </div>
        </div>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-stone-700 hover:text-stone-900 transition p-1"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* DASHBOARD SIDEBAR (DESKTOP & RESPONSIVE DRAWER) */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-[#EAE4D8] border-r border-stone-300/80 flex flex-col justify-between py-6 px-4
        md:sticky md:h-screen md:translate-x-0 md:pointer-events-auto transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none md:pointer-events-auto'}
      `}>
        <div className="space-y-6">
          {/* Logo Brand */}
          <div className="hidden md:flex items-center gap-2.5 pb-2 border-b border-stone-300/50">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-indigo-600 flex items-center justify-center font-extrabold text-white text-lg font-display shadow-sm">
              ₱
            </div>
            <div>
              <h1 className="font-extrabold font-display text-md tracking-tight leading-tight text-stone-900">Finance Tracker</h1>
              <p className="text-[10px] text-stone-500 font-extrabold uppercase leading-none font-display tracking-widest mt-0.5">DINK Dual Engine</p>
            </div>
          </div>

          {/* DINK Household Profiles Card (Interactive) */}
          <div className="bg-[#FAF8F5]/85 border border-stone-300/70 rounded-2xl p-3 flex flex-col gap-2 shadow-xs group">
            <div className="flex items-center gap-2.5">
              <div className="flex relative shrink-0">
                {renderPartnerAvatarInApp(state.partnerNames.youPic, state.partnerNames.you, "w-8 h-8 text-xs")}
                <div className="ml-[-12px] relative z-10">
                  {renderPartnerAvatarInApp(state.partnerNames.partnerPic, state.partnerNames.partner, "w-8 h-8 text-xs")}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-[#8E8779] font-extrabold uppercase font-display tracking-wider leading-none">DINK Household</div>
                <div className="text-[11px] font-black text-stone-900 font-display truncate leading-tight mt-0.5">
                  {state.partnerNames.you} & {state.partnerNames.partner}
                </div>
                {user ? (
                  <div className="text-[8px] text-teal-800 font-bold truncate flex items-center gap-0.5 leading-none mt-0.5">
                    <span className="w-1 h-1 rounded-full bg-teal-500 inline-block animate-pulse"></span>
                    {user.email}
                  </div>
                ) : (
                  <div className="text-[8px] text-stone-400 font-semibold leading-none mt-0.5">Offline Sandbox mode</div>
                )}
              </div>
              <button 
                onClick={() => {
                  setEditYouName(state.partnerNames.you);
                  setEditPartnerName(state.partnerNames.partner);
                  setEditYouPic(state.partnerNames.youPic || 'av_man1');
                  setEditPartnerPic(state.partnerNames.partnerPic || 'av_woman1');
                  setShowEditYouCustom(state.partnerNames.youPic?.startsWith('http') || false);
                  setShowEditPartnerCustom(state.partnerNames.partnerPic?.startsWith('http') || false);
                  if (state.partnerNames.youPic?.startsWith('http')) setEditYouCustomUrl(state.partnerNames.youPic);
                  if (state.partnerNames.partnerPic?.startsWith('http')) setEditPartnerCustomUrl(state.partnerNames.partnerPic);
                  
                  setActiveModal('editProfile');
                }}
                className="p-1.5 bg-[#EAE4D8] hover:bg-[#DDD8CE] text-stone-600 hover:text-stone-950 rounded-lg transition shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Edit Partners Profiles & Avatars"
              >
                <Users size={12} />
              </button>
            </div>
          </div>

          {/* Navigation link group */}
          <nav className="space-y-1">
            <button 
              onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition font-display ${activeTab === 'overview' ? 'bg-[#DDD8CE] text-stone-900 border-l-4 border-emerald-600 font-extrabold' : 'text-stone-500 hover:bg-stone-300/20 hover:text-stone-800'}`}
            >
              <PieChart size={15} /> Overview
            </button>
            <button 
              onClick={() => { setActiveTab('transactions'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition font-display ${activeTab === 'transactions' ? 'bg-[#DDD8CE] text-stone-900 border-l-4 border-emerald-600 font-extrabold' : 'text-stone-500 hover:bg-stone-300/20 hover:text-stone-800'}`}
            >
              <Wallet size={15} /> Ledger Entries
            </button>
            <button 
              onClick={() => { setActiveTab('credit'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition font-display ${activeTab === 'credit' ? 'bg-[#DDD8CE] text-stone-900 border-l-4 border-emerald-600 font-extrabold' : 'text-stone-500 hover:bg-stone-300/20 hover:text-stone-800'}`}
            >
              <CardIcon size={15} /> Credit Cards
            </button>
            <button 
              onClick={() => { setActiveTab('budget'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition font-display ${activeTab === 'budget' ? 'bg-[#DDD8CE] text-stone-900 border-l-4 border-emerald-600 font-extrabold' : 'text-stone-500 hover:bg-stone-300/20 hover:text-stone-800'}`}
            >
              <LineChart size={15} /> Budget Strategy
            </button>
            <button 
              onClick={() => { setActiveTab('analysis'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition font-display ${activeTab === 'analysis' ? 'bg-[#DDD8CE] text-stone-900 border-l-4 border-emerald-600 font-extrabold' : 'text-stone-500 hover:bg-stone-300/20 hover:text-stone-800'}`}
            >
              <Users size={15} /> Income Analysis
            </button>
          </nav>
        </div>

        {/* Dynamic Net Cash & Backups control */}
        <div className="space-y-4 pt-4 border-t border-stone-300/50">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 font-display">Household Net Liquidity</span>
            <div className={`text-2xl font-black font-display tracking-tight mt-1 ${cashOnHandTotal >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatPeso(cashOnHandTotal)}
            </div>
            <p className="text-[10px] text-stone-400 font-semibold leading-relaxed mt-1">Matched cash income less matched cash spendings</p>
          </div>

          <div className="space-y-2">
            <button 
              onClick={handleLogActiveSessionOut}
              className="w-full bg-[#E3DCD0] hover:bg-[#DDD8CE] text-stone-700 hover:text-stone-900 font-bold text-[10px] py-2 px-2.5 rounded-lg border border-stone-300/60 transition inline-flex items-center justify-center gap-1.5 font-display uppercase tracking-wider shadow-sm cursor-pointer"
            >
              <LogOut size={11} /> Log Out
            </button>
          </div>

          <SupabaseSync 
            syncStatus={syncStatus}
            onPull={fetchFromSupabase}
            onPush={() => saveToSupabase(state)}
            localBackupSize={JSON.stringify(state).length}
          />
        </div>
      </aside>

      {/* Main backdrop masking */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-30"
        ></div>
      )}

      {/* WORKSPACE APP CONTAINER */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'overview' && (
              <Overview 
                state={state} 
                onAdjustTarget={() => setActiveModal('savingsTarget')}
                onAddCashAccount={() => setActiveModal('addCashAccount')}
                onDeleteCashAccount={deleteCashAccount}
              />
            )}

            {activeTab === 'transactions' && (
              <Transactions 
                state={state}
                addIncome={addIncome}
                addExpense={addExpense}
                addTransfer={addTransfer}
                deleteIncome={deleteIncome}
                deleteExpense={deleteExpense}
                deleteTransfer={deleteTransfer}
                updateIncome={updateIncome}
                updateExpense={updateExpense}
                updateTransfer={updateTransfer}
                activeModal={activeModal}
                setActiveModal={setActiveModal}
                settleCardId={settleCardId}
                setSettleCardId={setSettleCardId}
              />
            )}

            {activeTab === 'credit' && (
              <CreditCards 
                state={state}
                addCard={addCard}
                deleteCard={deleteCard}
                triggerSettleCard={(cardId) => {
                  setSettleCardId(cardId);
                  setActiveModal('settleCard');
                }}
                activeModal={activeModal}
                setActiveModal={setActiveModal}
              />
            )}

            {activeTab === 'budget' && (
              <BudgetStrategy 
                state={state}
                addBudget={addBudget}
                deleteBudget={deleteBudget}
                updateBudgetLimit={updateBudgetLimit}
                addAmortization={addAmortization}
                deleteAmortization={deleteAmortization}
                budgetMonth={budgetMonth}
                setBudgetMonth={setBudgetMonth}
                activeModal={activeModal}
                setActiveModal={setActiveModal}
              />
            )}

            {activeTab === 'analysis' && (
              <IncomeAnalysis 
                state={state}
                updateSalary={updateSalary}
                updateDeductions={updateDeductions}
                addIncomeSource={addIncomeSource}
                deleteIncomeSource={deleteIncomeSource}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ─── GLOBAL SYSTEM MODALS (TRIGGERED VIA WORKSPACE) ─── */}
      <AnimatePresence>
        {activeModal === 'savingsTarget' && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-2xl w-full max-w-sm"
            >
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-stone-200">
                <h3 className="text-sm font-extrabold uppercase font-display tracking-widest text-stone-500">Savings Target Limit</h3>
                <button onClick={() => setActiveModal(null)} className="text-stone-400 hover:text-stone-605 hover:text-stone-600">
                  &times;
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5 text-xs font-semibold text-stone-700">
                  <label className="text-[10px] font-extrabold uppercase tracking-wide text-stone-400 font-display">Target Base Amount (₱)</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    className="w-full text-xs font-black border border-stone-200 rounded-xl p-2.5 outline-none font-display focus:border-stone-400 bg-stone-100 text-right text-emerald-800"
                    value={targetValInput || (state.settings.monthlySavingsTarget ? formatPeso(state.settings.monthlySavingsTarget) : '')}
                    onChange={e => setTargetValInput(formatAsYouTypeHTML(e.target.value))}
                    onBlur={e => {
                      const num = parseMoney(e.target.value);
                      setTargetValInput(num > 0 ? formatPeso(num) : '');
                    }}
                  />
                  <p className="text-[9px] mt-1 text-stone-400 font-semibold leading-relaxed">
                    💡 This target gets compared against combined Cash Pools to highlight the financial shortfall or achievement.
                  </p>
                </div>
                <div className="flex gap-2 justify-end pt-2 border-t border-stone-200">
                  <button onClick={() => { setTargetValInput(''); setActiveModal(null); }} className="btn btn-ghost text-xs">Cancel</button>
                  <button onClick={() => { submitSavingsTargetValue(targetValInput); setTargetValInput(''); }} className="btn btn-primary text-xs bg-stone-900 hover:bg-stone-800">Save Target</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {activeModal === 'addCashAccount' && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-2xl w-full max-w-sm"
            >
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-stone-200">
                <h3 className="text-sm font-extrabold uppercase font-display tracking-widest text-stone-500">Add Cash Asset Pool</h3>
                <button onClick={() => setActiveModal(null)} className="text-stone-400 hover:text-stone-600">
                  &times;
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5 text-xs font-semibold text-stone-700">
                  <label className="text-[10px] font-extrabold uppercase tracking-wide text-stone-400 font-display">Account Nomenclature</label>
                  <input 
                    type="text" 
                    placeholder="e.g. BDO Savings, Joint Vault, Ledger Vault"
                    value={newCashPoolName}
                    onChange={e => setNewCashPoolName(e.target.value)}
                    className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2.5 outline-none focus:border-stone-400 bg-stone-100"
                  />
                </div>

                <div className="space-y-1.5 text-xs font-semibold text-stone-700">
                  <label className="text-[10px] font-extrabold uppercase tracking-wide text-stone-400 font-display">Custom Tag Color</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={newCashPoolColor}
                      onChange={e => setNewCashPoolColor(e.target.value)}
                      className="w-14 h-10 p-0.5 border border-stone-200 rounded-xl cursor-pointer bg-stone-50"
                    />
                    <div className="flex-1 flex gap-1.5 flex-wrap items-center">
                      {CASH_COLORS.map(c => (
                        <button 
                          key={c}
                          type="button"
                          className="w-6 h-6 rounded-full border border-stone-200"
                          style={{ backgroundColor: c }}
                          onClick={() => setNewCashPoolColor(c)}
                        ></button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-stone-200">
                  <button onClick={() => setActiveModal(null)} className="btn btn-ghost text-xs">Cancel</button>
                  <button onClick={submitNewCashPool} className="btn btn-primary text-xs bg-stone-900 hover:bg-stone-800">Create Pool</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {activeModal === 'editProfile' && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-stone-50 border border-stone-200 rounded-[32px] p-6 shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-stone-200">
                <div className="flex items-center gap-1.5">
                  <Users className="text-[#0D9E80]" size={16} />
                  <h3 className="text-xs font-extrabold uppercase font-display tracking-widest text-stone-605 text-stone-600">Household Profiles</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-stone-400 hover:text-stone-600 text-xl font-bold p-1">
                  &times;
                </button>
              </div>

              <div className="space-y-4">
                {/* PARTNER 1 (YOU) */}
                <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-stone-200 space-y-2">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#0D9E80] font-display">Partner 1 (You)</span>
                  <div className="space-y-1 text-xs">
                    <label className="text-[8px] font-black text-stone-400 uppercase tracking-wider">Your Name</label>
                    <input 
                      type="text"
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2 focus:border-stone-400 outline-none bg-white"
                      value={editYouName}
                      onChange={e => setEditYouName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <label className="text-[8px] font-black text-stone-400 uppercase tracking-wider">Select Avatar</label>
                      <button 
                        type="button" 
                        onClick={() => setShowEditYouCustom(!showEditYouCustom)}
                        className="text-[8px] text-teal-850 font-bold hover:underline"
                      >
                        {showEditYouCustom ? 'Preset list' : 'Custom photo link'}
                      </button>
                    </div>

                    {showEditYouCustom ? (
                      <input 
                        type="url"
                        className="w-full text-[10px] border border-stone-200 rounded-xl p-2 focus:border-stone-400 outline-none bg-white font-mono"
                        placeholder="https://..."
                        value={editYouCustomUrl}
                        onChange={e => setEditYouCustomUrl(e.target.value)}
                      />
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {AVATAR_PRESETS.map(preset => {
                          const isSel = editYouPic === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setEditYouPic(preset.id)}
                              className={`p-1 rounded-xl border flex flex-col items-center justify-center transition ${isSel ? 'bg-emerald-100/60 border-emerald-500/40' : 'bg-white border-stone-200 hover:bg-stone-50'}`}
                            >
                              <span className="text-lg leading-none">{preset.emoji}</span>
                              <span className="text-[7px] text-stone-400 truncate w-full text-center leading-none mt-1">{preset.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* PARTNER 2 */}
                <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-stone-200 space-y-2">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#4F54D4] font-display">Partner 2</span>
                  <div className="space-y-1 text-xs">
                    <label className="text-[8px] font-black text-stone-400 uppercase tracking-wider">Partner Name</label>
                    <input 
                      type="text"
                      className="w-full text-xs font-semibold border border-stone-200 rounded-xl p-2 focus:border-stone-400 outline-none bg-white"
                      value={editPartnerName}
                      onChange={e => setEditPartnerName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <label className="text-[8px] font-black text-stone-400 uppercase tracking-wider">Select Avatar</label>
                      <button 
                        type="button" 
                        onClick={() => setShowEditPartnerCustom(!showEditPartnerCustom)}
                        className="text-[8px] text-teal-850 font-bold hover:underline"
                      >
                        {showEditPartnerCustom ? 'Preset list' : 'Custom photo link'}
                      </button>
                    </div>

                    {showEditPartnerCustom ? (
                      <input 
                        type="url"
                        className="w-full text-[10px] border border-stone-200 rounded-xl p-2 focus:border-stone-400 outline-none bg-white font-mono"
                        placeholder="https://..."
                        value={editPartnerCustomUrl}
                        onChange={e => setEditPartnerCustomUrl(e.target.value)}
                      />
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {AVATAR_PRESETS.map(preset => {
                          const isSel = editPartnerPic === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setEditPartnerPic(preset.id)}
                              className={`p-1 rounded-xl border flex flex-col items-center justify-center transition ${isSel ? 'bg-[#4F54D4]/10 border-[#4F54D4]/30' : 'bg-white border-stone-200 hover:bg-stone-50'}`}
                            >
                              <span className="text-lg leading-none">{preset.emoji}</span>
                              <span className="text-[7px] text-stone-400 truncate w-full text-center leading-none mt-1">{preset.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-stone-250">
                  <button onClick={() => setActiveModal(null)} className="btn btn-ghost text-xs">Cancel</button>
                  <button onClick={saveUpdatedProfiles} className="btn btn-primary text-xs bg-stone-900 hover:bg-stone-800 text-white font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer">Save Profiles</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
