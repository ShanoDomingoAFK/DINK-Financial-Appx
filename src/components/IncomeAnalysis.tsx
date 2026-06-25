/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  DollarSign, 
  Trash2, 
  HelpCircle, 
  Briefcase, 
  BookOpen,
  PlusCircle,
  Coins,
  Percent
} from 'lucide-react';
import { GlobalState, IncomeStream, PartnerDeductions } from '../types';
import { formatPeso, parseMoney, formatAsYouTypeHTML } from '../utils';

interface AmountInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
}

function AmountInput({ value, onChange, className = "w-24 text-right font-extrabold border border-stone-200 rounded-lg p-1 px-2.5 outline-none bg-stone-50 font-display", placeholder }: AmountInputProps) {
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
      placeholder={placeholder || "₱ 0.00"}
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

interface IncomeAnalysisProps {
  state: GlobalState;
  updateSalary: (earner: 'you' | 'partner', val: number) => void;
  updateDeductions: (earner: 'you' | 'partner', field: keyof PartnerDeductions, val: number) => void;
  addIncomeSource: (desc: string, expectedAmt: number, earner: 'you' | 'partner') => void;
  deleteIncomeSource: (id: string) => void;
}

export default function IncomeAnalysis({
  state,
  updateSalary,
  updateDeductions,
  addIncomeSource,
  deleteIncomeSource
}: IncomeAnalysisProps) {
  // Local states for adding freelance consulting streams
  const [streamId, setStreamId] = useState('');
  const [streamAmt, setStreamAmt] = useState('');
  const [streamEarner, setStreamEarner] = useState<'you' | 'partner'>('you');

  // Compute stats for both partners
  const computeIncomeFramework = (earnerKey: 'you' | 'partner') => {
    const baseVal = state.salaries[earnerKey];
    
    // Freelance side consulting income streams assigned specifically to this earner
    const additionalVal = state.incomeSources
      .filter(s => s.earner === earnerKey)
      .reduce((sum, s) => sum + s.expectedAmt, 0);

    const grossTotal = baseVal + additionalVal;

    const d = state.deductions[earnerKey];
    const totalDeductions = d.sss + d.phic + d.hdmf + d.tax;
    const netYield = Math.max(0, grossTotal - totalDeductions);

    return {
      additionalVal,
      grossTotal,
      sss: d.sss,
      phic: d.phic,
      hdmf: d.hdmf,
      tax: d.tax,
      totalDeductions,
      netYield
    };
  };

  const aidenMetrics = computeIncomeFramework('you');
  const chloeMetrics = computeIncomeFramework('partner');

  const handleAddStream = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseMoney(streamAmt);
    if (!streamId.trim() || amt <= 0) return;

    addIncomeSource(streamId.trim(), amt, streamEarner);
    setStreamId('');
    setStreamAmt('');
  };

  return (
    <div className="space-y-6">
      {/* Upper toolbar */}
      <div>
        <h1 className="text-2xl font-black font-display text-stone-900 tracking-tight">Income Analysis</h1>
        <p className="text-stone-500 font-semibold text-xs mt-0.5">Model gross, manual progressive deductions (BIR tax / SSS / Philhealth), and secondary Consulting Portfolios</p>
      </div>

      {/* Side-by-Side Partner Framework Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Partner 1: Aiden */}
        <div className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex justify-between items-center pb-2 border-b border-stone-200">
            <h3 className="text-sm font-black text-emerald-800 uppercase tracking-widest font-display">
              {state.partnerNames.you}'s Revenue Framework
            </h3>
            <span className="text-[10px] bg-stone-200 text-stone-700 font-bold px-2 py-0.5 rounded-full uppercase font-display">
              Standard partner
            </span>
          </div>

          <div className="space-y-4">
            {/* Base Salary Input */}
            <div className="flex justify-between items-center text-xs font-semibold text-stone-700">
              <span className="font-display">Gross Salary</span>
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400 font-bold">₱</span>
                <AmountInput 
                  value={state.salaries.you}
                  onChange={val => updateSalary('you', val)}
                  className="w-32 text-xs font-black border border-stone-200 rounded-lg p-1.5 px-2 px-2.5 outline-none focus:border-stone-400 bg-stone-100/50 focus:bg-stone-50 text-right font-display"
                />
              </div>
            </div>

            {/* Consulting extra flows display */}
            <div className="flex justify-between items-center text-xs font-semibold text-stone-500">
              <span className="font-display">Additonal Income</span>
              <span className="font-bold font-display text-emerald-700">+{formatPeso(aidenMetrics.additionalVal)}</span>
            </div>

            {/* Combined Gross Total */}
            <div className="flex justify-between items-center text-xs font-bold text-stone-700 pt-2 border-t border-stone-200/50">
              <span className="font-display text-[10px] uppercase tracking-wider text-stone-400">Total Combined Gross</span>
              <span className="text-sm font-extrabold font-display leading-none text-stone-850">{formatPeso(aidenMetrics.grossTotal)}</span>
            </div>

            {/* Deduction manual overrides card */}
            <div className="bg-stone-100/60 rounded-2xl p-4 border border-stone-200/75 space-y-3.5 text-xs text-stone-600 font-semibold">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-stone-450 block font-display">Manual Monthly Deductions</span>
              
              <div className="flex justify-between items-center">
                <span>SSS Premium Contribution</span>
                <AmountInput 
                  value={aidenMetrics.sss}
                  onChange={val => updateDeductions('you', 'sss', val)}
                />
              </div>

              <div className="flex justify-between items-center">
                <span>PhilHealth (PHIC) Premium</span>
                <AmountInput 
                  value={aidenMetrics.phic}
                  onChange={val => updateDeductions('you', 'phic', val)}
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Pag-IBIG (HDMF) Premium</span>
                <AmountInput 
                  value={aidenMetrics.hdmf}
                  onChange={val => updateDeductions('you', 'hdmf', val)}
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-dashed border-stone-200">
                <span className="font-extrabold text-stone-700">BIR Withholding Tax</span>
                <AmountInput 
                  value={aidenMetrics.tax}
                  onChange={val => updateDeductions('you', 'tax', val)}
                  className="w-24 text-right font-black border border-stone-200 rounded-lg p-1 px-2.5 outline-none bg-stone-50 text-red-800 font-display"
                />
              </div>
            </div>

            {/* Net take-home yield */}
            <div className="flex justify-between items-center pt-3 border-t-2 border-stone-200 text-stone-850">
              <span className="font-black font-display text-xs uppercase tracking-wider text-stone-400">NET FINANCIAL REVENUE YIELD</span>
              <span className="text-xl font-black font-display text-emerald-800 leading-none">{formatPeso(aidenMetrics.netYield)}</span>
            </div>
          </div>
        </div>

        {/* Partner 2: Chloe */}
        <div className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex justify-between items-center pb-2 border-b border-stone-200">
            <h3 className="text-sm font-black text-indigo-850 uppercase tracking-widest font-display text-indigo-905">
              {state.partnerNames.partner}'s Revenue Framework
            </h3>
            <span className="text-[10px] bg-stone-200 text-stone-700 font-bold px-2 py-0.5 rounded-full uppercase font-display">
              Primary partner
            </span>
          </div>

          <div className="space-y-4">
            {/* Base Salary Input */}
            <div className="flex justify-between items-center text-xs font-semibold text-stone-700">
              <span className="font-display">Gross Salary</span>
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400 font-bold">₱</span>
                <AmountInput 
                  value={state.salaries.partner}
                  onChange={val => updateSalary('partner', val)}
                  className="w-32 text-xs font-black border border-stone-200 rounded-lg p-1.5 px-2.5 outline-none focus:border-stone-400 bg-stone-100/50 focus:bg-stone-50 text-right font-display"
                />
              </div>
            </div>

            {/* Consulting extra flows display */}
            <div className="flex justify-between items-center text-xs font-semibold text-stone-500">
              <span className="font-display">Additional Income</span>
              <span className="font-bold font-display text-emerald-700">+{formatPeso(chloeMetrics.additionalVal)}</span>
            </div>

            {/* Combined Gross Total */}
            <div className="flex justify-between items-center text-xs font-bold text-stone-700 pt-2 border-t border-stone-200/50">
              <span className="font-display text-[10px] uppercase tracking-wider text-stone-400">Total Combined Gross</span>
              <span className="text-sm font-extrabold font-display leading-none text-stone-850">{formatPeso(chloeMetrics.grossTotal)}</span>
            </div>

            {/* Deduction manual overrides card */}
            <div className="bg-stone-100/60 rounded-2xl p-4 border border-stone-200/75 space-y-3.5 text-xs text-stone-600 font-semibold">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-stone-450 block font-display">Manual Monthly Deductions</span>
              
              <div className="flex justify-between items-center">
                <span>SSS Premium Contribution</span>
                <AmountInput 
                  value={chloeMetrics.sss}
                  onChange={val => updateDeductions('partner', 'sss', val)}
                />
              </div>

              <div className="flex justify-between items-center">
                <span>PhilHealth (PHIC) Premium</span>
                <AmountInput 
                  value={chloeMetrics.phic}
                  onChange={val => updateDeductions('partner', 'phic', val)}
                />
              </div>

              <div className="flex justify-between items-center">
                <span>Pag-IBIG (HDMF) Premium</span>
                <AmountInput 
                  value={chloeMetrics.hdmf}
                  onChange={val => updateDeductions('partner', 'hdmf', val)}
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-dashed border-stone-200">
                <span className="font-extrabold text-stone-700">BIR Withholding Tax</span>
                <AmountInput 
                  value={chloeMetrics.tax}
                  onChange={val => updateDeductions('partner', 'tax', val)}
                  className="w-24 text-right font-black border border-stone-200 rounded-lg p-1 px-2.5 outline-none bg-stone-50 text-red-800 font-display"
                />
              </div>
            </div>

            {/* Net take-home yield */}
            <div className="flex justify-between items-center pt-3 border-t-2 border-stone-200 text-stone-850">
              <span className="font-black font-display text-xs uppercase tracking-wider text-stone-400">NET FINANCIAL REVENUE YIELD</span>
              <span className="text-xl font-black font-display text-emerald-800 leading-none">{formatPeso(chloeMetrics.netYield)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Side consulting freelance portfolios mapper card */}
      <div className="bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div>
          <h3 className="text-base font-extrabold text-stone-900 font-display tracking-tight flex items-center gap-1.5">
            <Briefcase size={16} className="text-stone-600" /> Secondary Income
          </h3>
          <p className="text-xs text-stone-400 font-semibold mt-0.5 leading-relaxed">
            Incorporate architectural consultancy, yoga certifications, allowances, or other third-party checking inflows.
          </p>
        </div>

        {/* Input Form to append stream */}
        <form onSubmit={handleAddStream} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2 space-y-1.5 text-xs font-semibold text-stone-600">
            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block font-display">Revenue Source Description</label>
            <input 
              type="text" 
              className="w-full text-xs font-semibold border border-stone-250 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 bg-stone-50"
              placeholder="e.g. Blueprint design consulting base"
              value={streamId}
              onChange={e => setStreamId(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5 text-xs font-semibold text-stone-600">
            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block font-display">Expected Amt (₱)</label>
            <input 
              type="text" 
              inputMode="decimal"
              className="w-full text-xs font-black border border-stone-250 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 bg-stone-50 text-right font-display text-emerald-855"
              placeholder="₱ 10,000.00"
              value={streamAmt}
              onChange={e => setStreamAmt(formatAsYouTypeHTML(e.target.value))}
              onBlur={e => {
                const num = parseMoney(e.target.value);
                setStreamAmt(num > 0 ? formatPeso(num) : '');
              }}
              required
            />
          </div>

          <div className="space-y-1.5 text-xs font-semibold text-stone-600">
            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block font-display">Assigned earner</label>
            <div className="flex gap-2">
              <select 
                className="w-full text-xs font-semibold border border-stone-250 rounded-xl p-2.5 bg-stone-100/50 outline-none focus:border-stone-400 bg-stone-50 cursor-pointer"
                value={streamEarner}
                onChange={e => setStreamEarner(e.target.value as any)}
                required
              >
                <option value="you">{state.partnerNames.you}</option>
                <option value="partner">{state.partnerNames.partner}</option>
              </select>
              <button 
                type="submit" 
                className="bg-stone-900 text-stone-100 hover:bg-stone-850 text-xs px-3.5 font-bold rounded-xl transition flex-shrink-0"
              >
                Include
              </button>
            </div>
          </div>
        </form>

        {/* Existing additional sources table */}
        <div className="space-y-2.5 pt-2">
          {state.incomeSources.map(s => {
            const owner = s.earner === 'you' ? state.partnerNames.you : state.partnerNames.partner;
            return (
              <div 
                key={s.id} 
                className="bg-stone-100/60 p-4 border border-stone-200/50 rounded-2xl flex justify-between items-center hover:bg-stone-100 transition"
              >
                <div className="space-y-0.5 text-xs">
                  <div className="font-extrabold text-stone-800 font-display">{s.desc}</div>
                  <div className="text-[10px] text-stone-400 font-semibold leading-none flex items-center gap-1.5">
                    <span>Revenue earner:</span>
                    <span className="font-bold text-stone-550">{owner}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <strong className="text-sm font-black text-emerald-800 font-display">+{formatPeso(s.expectedAmt)}</strong>
                  <button
                    onClick={() => deleteIncomeSource(s.id)}
                    className="text-stone-400 hover:text-red-650 p-1 hover:bg-red-50 rounded-lg transition"
                    title="Remove item"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {state.incomeSources.length === 0 && (
            <div className="text-center py-6 text-stone-400 text-xs italic font-semibold border border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
              No additional secondary income portfolio positions mapped.
            </div>
          )}
        </div>
      </div>

      {/* Contributions guidelines guidelines */}
      <div className="bg-stone-150/40 p-5 border border-stone-200 rounded-3xl space-y-3.5 text-xs text-stone-500 font-semibold leading-relaxed">
        <h4 className="font-extrabold font-display leading-tight text-stone-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
          <BookOpen size={13} className="text-stone-550" /> Guidelines for Couples (DINK Net Engine)
        </h4>
        <p className="font-medium text-stone-500">
          • <strong>Tax Parameter Customizing:</strong> Withholding taxes under the BIR TRAIN system depend on gross scales. Simply adjust the Withholding Tax boxes directly for Aiden and Chloe which immediately matches net headroom calculations.
        </p>
        <p className="font-medium text-stone-500">
          • <strong>Joint Pool Assets:</strong> Dynamic Cash Accounts and Ledger entries support marking assignees as <span className="font-bold text-stone-700">Joint</span>, <span className="font-bold text-emerald-700">Aiden</span>, or <span className="font-bold text-indigo-700">Chloe</span>. Category SOAs compute contribution ratios cleanly based on designated transaction owners.
        </p>
      </div>
    </div>
  );
}
