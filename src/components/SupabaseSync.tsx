import React, { useState } from 'react';
import { 
  Cloud, 
  CloudOff, 
  Loader2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Database,
  Copy,
  Check,
  X,
  ArrowUpRight,
  HelpCircle
} from 'lucide-react';
import { supabase, SUPABASE_TABLE, SUPABASE_DOC_ID } from '../supabase';

interface SupabaseSyncProps {
  syncStatus: 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'unconfigured' | 'relation_missing';
  onPull: () => Promise<void>;
  onPush: () => Promise<void>;
  localBackupSize: number;
}

export default function SupabaseSync({ syncStatus, onPull, onPush, localBackupSize }: SupabaseSyncProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const sqlCode = `-- 1. Create the table to store your uniform DINK finance state
CREATE TABLE IF NOT EXISTS ${SUPABASE_TABLE} (
  id text PRIMARY KEY,
  state jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create the table to store 6-digit User secure PINs
CREATE TABLE IF NOT EXISTS dink_user_pins (
  email text PRIMARY KEY,
  pin text NOT NULL,
  user_id uuid NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Turn off Row Level Security (RLS) for simple public custom security lookups
ALTER TABLE ${SUPABASE_TABLE} DISABLE ROW LEVEL SECURITY;
ALTER TABLE dink_user_pins DISABLE ROW LEVEL SECURITY;

-- 4. (Optional) Or if keeping RLS enabled, run this to let anonymous users read & write state
-- CREATE POLICY "Allow public read and write" 
-- ON ${SUPABASE_TABLE} 
-- FOR ALL 
-- TO anon 
-- USING (true) 
-- WITH CHECK (true);`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderStatus = () => {
    switch (syncStatus) {
      case 'unconfigured':
        return (
          <div className="bg-amber-100/60 border border-amber-500/10 rounded-xl p-3 text-stone-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800">
                <CloudOff size={14} className="text-amber-600" />
                <span>Offline Local Mode</span>
              </div>
              <button 
                onClick={() => setShowModal(true)}
                className="text-amber-700 hover:text-amber-900 transition p-0.5"
                title="Credential details"
              >
                <HelpCircle size={14} />
              </button>
            </div>
            <p className="text-[10px] text-stone-500 mt-1 leading-relaxed font-semibold">
              Currently persisting your data to local storage. Set up cloud secrets to sync automatically.
            </p>
          </div>
        );

      case 'relation_missing':
        return (
          <div className="bg-red-50 border border-red-500/15 rounded-xl p-3 text-stone-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-red-800">
                <AlertCircle size={14} className="text-red-600 animate-pulse" />
                <span>Table Missing</span>
              </div>
              <button 
                onClick={() => setShowModal(true)}
                className="text-red-700 hover:text-red-900 transition p-0.5"
                title="Setup guide"
              >
                <HelpCircle size={14} />
              </button>
            </div>
            <p className="text-[10px] text-stone-500 mt-1 leading-relaxed font-semibold">
              The Supabase table `<code className="bg-red-100 p-0.5 px-1 rounded text-red-800 font-mono text-[9px]">{SUPABASE_TABLE}</code>` does not exist yet.
            </p>
            <div className="flex items-center justify-end mt-2 pt-2 border-t border-red-500/5">
              <button 
                onClick={onPush}
                className="text-[9px] bg-red-800 text-white font-extrabold px-2.5 py-1 rounded hover:bg-red-950 transition shadow-sm cursor-pointer"
              >
                Retry Setup
              </button>
            </div>
          </div>
        );

      case 'loading':
        return (
          <div className="bg-stone-200/50 border border-stone-300/60 rounded-xl p-3">
            <div className="flex items-center gap-2 font-bold text-xs text-stone-700">
              <Loader2 size={13} className="text-stone-500 animate-spin" />
              <span>Fetching remote state...</span>
            </div>
          </div>
        );

      case 'saving':
        return (
          <div className="bg-emerald-50 border border-emerald-500/10 rounded-xl p-3">
            <div className="flex items-center gap-2 font-bold text-xs text-emerald-800">
              <Loader2 size={13} className="text-emerald-600 animate-spin" />
              <span>Saving changes...</span>
            </div>
          </div>
        );

      case 'synced':
      case 'idle':
        return (
          <div className="bg-emerald-100/60 border border-emerald-500/10 rounded-xl p-3 text-stone-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Cloud Synced</span>
              </div>
              <button 
                onClick={() => setShowModal(true)}
                className="text-emerald-700 hover:text-emerald-950 transition p-0.5"
                title="Cloud database details"
              >
                <HelpCircle size={14} />
              </button>
            </div>
            <p className="text-[10px] text-stone-500 mt-1 leading-relaxed font-semibold">
              Your entries are safely synced live with your cloud database.
            </p>
          </div>
        );

      case 'error':
      default:
        return (
          <div className="bg-red-50 border border-red-500/15 rounded-xl p-3 text-stone-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-red-800">
                <AlertCircle size={14} className="text-red-600" />
                <span>Sync Error</span>
              </div>
              <button 
                onClick={() => setShowModal(true)}
                className="text-red-700 hover:text-red-950 transition p-0.5"
                title="Troubleshoot Guide"
              >
                <HelpCircle size={14} />
              </button>
            </div>
            <p className="text-[10px] text-stone-500 mt-1 leading-relaxed font-semibold">
              Failed to sync updates to Supabase. Check connections or secrets.
            </p>
            <div className="flex gap-1.5 mt-2 pt-2 border-t border-red-500/5 justify-end">
              <button 
                onClick={onPull}
                className="py-1 px-2.5 bg-red-800 hover:bg-red-900 text-white font-extrabold rounded-lg text-[9px] uppercase tracking-wider inline-flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
              >
                <RefreshCw size={10} /> Retry Pull
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#8E8779] font-display py-1">
          <Database size={11} className="text-[#8E8779]" />
          <span>Database Sync</span>
        </div>
        {renderStatus()}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FAF8F5] border border-stone-300 rounded-2xl w-full max-w-lg p-5 shadow-2xl max-h-[85vh] overflow-y-auto font-sans">
            <div className="flex justify-between items-start border-b border-stone-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Database className="text-emerald-700" size={20} />
                <div>
                  <h3 className="font-extrabold font-display text-sm text-stone-900">Supabase Integration Guide</h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider font-display">Path A Setup Instructions</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs font-medium text-stone-700 leading-relaxed">
              <div>
                <h4 className="font-extrabold text-stone-900 text-xs mb-1">Step 1: Set Environment Secrets</h4>
                <p className="mb-2">
                  In order to bind this frontend securely to your Supabase project, you must set these environment variables.
                </p>
                <div className="bg-stone-100 p-2 text-[10px] font-mono rounded-lg border border-stone-200 select-all font-semibold space-y-1">
                  <div>VITE_SUPABASE_URL= &lt;your_project_url&gt;</div>
                  <div>VITE_SUPABASE_ANON_KEY= &lt;your_anon_public_key&gt;</div>
                </div>
                <p className="mt-2 text-[10px] text-stone-500 italic">
                  💡 You can add these in the **Secrets Panel** of your AI Studio environment! The platform automatically loads them.
                </p>
              </div>

              <div className="border-t border-stone-200 pt-4">
                <h4 className="font-extrabold text-stone-900 text-xs mb-1 flex items-center justify-between">
                  <span>Step 2: Create Table SQL</span>
                  <button 
                    onClick={copySqlToClipboard}
                    className="text-[9px] bg-stone-200 text-stone-700 font-extrabold hover:bg-stone-300 px-2 py-1 rounded inline-flex items-center gap-1 transition"
                  >
                    {copied ? <Check size={11} className="text-emerald-700" /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy SQL'}
                  </button>
                </h4>
                <p className="mb-2 text-stone-500">
                  Open your <strong>Supabase SQL Editor</strong> and run the following commands to create the required state table:
                </p>
                <pre className="bg-stone-950 text-emerald-400 p-3 text-[9px] font-mono rounded-lg overflow-x-auto border border-stone-800 leading-normal max-h-48 overflow-y-auto">
                  {sqlCode}
                </pre>
              </div>

              <div className="border-t border-stone-200 pt-4 bg-emerald-100/30 p-3 rounded-xl border border-emerald-500/10">
                <h4 className="font-extrabold text-emerald-950 text-xs mb-1 flex items-center gap-1">
                  <HelpCircle size={13} className="text-emerald-700" /> State-Aggregation Integrity
                </h4>
                <p className="text-[10px] text-emerald-900/80 leading-relaxed font-semibold">
                  This architecture bundles the DINK income stream, ledger entries, credit cards, auto-charges, and cash accounts into a single atomic JSON document. This completely eliminates manual synchronization issues and ensures real-time parity across both browsers.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-stone-200 mt-5">
              <button 
                onClick={() => setShowModal(false)}
                className="btn btn-primary text-xs bg-stone-900 hover:bg-stone-800 text-stone-50 font-display px-4 py-2"
              >
                Understood & Prepared
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
