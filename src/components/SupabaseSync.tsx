import React, { useState, useEffect } from 'react';
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
  HelpCircle,
  Monitor,
  Smartphone,
  Sparkles
} from 'lucide-react';
import { supabase, SUPABASE_TABLE, SUPABASE_DOC_ID } from '../supabase';

interface SupabaseSyncProps {
  syncStatus: 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'unconfigured' | 'relation_missing';
  onPull: () => Promise<void>;
  onPush: () => Promise<void>;
  localBackupSize: number;
  viewMode: 'auto' | 'desktop' | 'mobile';
  setViewMode: (mode: 'auto' | 'desktop' | 'mobile') => void;
}

export default function SupabaseSync({ 
  syncStatus, 
  onPull, 
  onPush, 
  localBackupSize,
  viewMode,
  setViewMode
}: SupabaseSyncProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const sqlCode = `-- 1. Create the tables to store your secure DINK finance state and backups
CREATE TABLE IF NOT EXISTS ${SUPABASE_TABLE} (
  id text PRIMARY KEY,
  state jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS dink_finance_v4_state_backups (
  backup_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id text NOT NULL,
  state_snapshot jsonb NOT NULL,
  backed_up_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
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
ALTER TABLE dink_finance_v4_state_backups DISABLE ROW LEVEL SECURITY;

-- 4. Set up an automatic trigger to permanently backup data before overwriting
CREATE OR REPLACE FUNCTION backup_dink_state()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO dink_finance_v4_state_backups (document_id, state_snapshot)
    VALUES (OLD.id, OLD.state);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_backup_dink_state ON ${SUPABASE_TABLE};
CREATE TRIGGER trg_backup_dink_state
BEFORE UPDATE ON ${SUPABASE_TABLE}
FOR EACH ROW
EXECUTE FUNCTION backup_dink_state();`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [showPopup, setShowPopup] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>(() => {
    return localStorage.getItem('dink_last_synced') || 'Never';
  });

  useEffect(() => {
    if (syncStatus === 'synced') {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const fullStr = `${new Date().toLocaleDateString()} ${nowStr}`;
      localStorage.setItem('dink_last_synced', fullStr);
      setLastSynced(fullStr);
    }
  }, [syncStatus]);

  let dotTitle = 'Disconnected / Sandbox';
  let syncDetail = 'Using offline local storage';
  let currentError = '';

  if (syncStatus === 'synced' || syncStatus === 'idle') {
    dotTitle = 'Cloud Connected';
    syncDetail = 'Data synced live with Supabase';
  } else if (syncStatus === 'loading' || syncStatus === 'saving') {
    dotTitle = 'Syncing...';
    syncDetail = syncStatus === 'loading' ? 'Downloading remote updates' : 'Uploading local changes';
  } else if (syncStatus === 'relation_missing') {
    dotTitle = 'Table Missing';
    syncDetail = `The table "${SUPABASE_TABLE}" was not found.`;
    currentError = 'Table missing in database. Open setup guide to create it.';
  } else if (syncStatus === 'error') {
    dotTitle = 'Connection Error';
    syncDetail = 'Failed to communicate with Supabase backend.';
    currentError = 'Check your connection or API keys inside Secrets.';
  } else if (syncStatus === 'unconfigured') {
    dotTitle = 'Offline Local';
    syncDetail = 'Using local storage persistence';
    currentError = 'Secrets unconfigured. Read setup guide to connect to Cloud.';
  }

  return (
    <>
      <div className="flex items-center justify-between gap-1.5 pt-3.5 border-t border-stone-300/50 mt-3 relative">
        {/* Cloud Status Dot Indicator */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowPopup(!showPopup)}
            className="flex items-center gap-1.5 hover:bg-stone-300/20 p-1.5 rounded-lg transition text-left cursor-pointer"
            title="Database Connection State"
          >
            <span className="relative flex h-2.5 w-2.5">
              {(syncStatus === 'loading' || syncStatus === 'saving') && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              )}
              {syncStatus === 'synced' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                (syncStatus === 'synced' || syncStatus === 'idle') ? 'bg-emerald-500 shadow-md shadow-emerald-500/40' :
                (syncStatus === 'loading' || syncStatus === 'saving') ? 'bg-amber-500 shadow-md shadow-amber-500/40' :
                syncStatus === 'unconfigured' ? 'bg-stone-400 shadow-md' : 'bg-red-500 shadow-md shadow-red-500/40'
              }`}></span>
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 font-display">
              Cloud Status
            </span>
          </button>
          
          {/* COMPACT DETAILED POPUP */}
          {showPopup && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#FAF8F5] border border-stone-300 rounded-xl p-3 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex justify-between items-center pb-1.5 border-b border-stone-200">
                <span className="text-[9px] font-extrabold text-[#8E8779] uppercase tracking-widest font-display">Sync Diagnostics</span>
                <button 
                  onClick={() => setShowPopup(false)} 
                  className="text-stone-400 hover:text-stone-700 transition"
                >
                  <X size={11} />
                </button>
              </div>
              
              <div className="space-y-2 mt-2 text-xs text-stone-700 font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-stone-400 font-extrabold uppercase">State</span>
                  <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                    (syncStatus === 'synced' || syncStatus === 'idle') ? 'bg-emerald-100 text-emerald-800' :
                    (syncStatus === 'loading' || syncStatus === 'saving') ? 'bg-amber-100 text-amber-800' :
                    'bg-red-50 text-red-700'
                  }`}>
                    {dotTitle}
                  </span>
                </div>

                <div className="text-[9px] leading-relaxed text-stone-500 bg-stone-100 p-1.5 rounded font-semibold">
                  {syncDetail}
                </div>

                {currentError && (
                  <div className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-200/50 p-1.5 rounded leading-normal">
                    ⚠️ {currentError}
                  </div>
                )}

                <div className="flex justify-between items-center text-[9px] text-stone-500 font-semibold">
                  <span>Last Sync:</span>
                  <span className="font-mono text-stone-700 font-bold">{lastSynced}</span>
                </div>

                <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-stone-200 text-[10px]">
                  <button
                    onClick={() => {
                      setShowPopup(false);
                      setShowModal(true);
                    }}
                    className="text-[9px] text-[#8E8779] hover:text-stone-950 font-extrabold uppercase tracking-wider flex items-center gap-0.5"
                  >
                    Setup Guide <ArrowUpRight size={10} />
                  </button>
                  {syncStatus !== 'unconfigured' && (
                    <button
                      onClick={async () => {
                        setShowPopup(false);
                        await onPull();
                      }}
                      className="text-[9px] bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold px-2 py-0.5 rounded transition"
                    >
                      Pull Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Responsive View Override Controls */}
        <div className="flex items-center gap-0.5 bg-[#E1D9CC]/50 p-0.5 rounded-lg border border-stone-300/40 shadow-inner shrink-0">
          <button
            onClick={() => setViewMode('auto')}
            className={`p-1 px-1.5 rounded-md text-[8px] font-bold uppercase transition flex items-center gap-0.5 cursor-pointer ${viewMode === 'auto' ? 'bg-[#FAF8F5] text-stone-800 shadow-xs font-extrabold border border-stone-300/20' : 'text-stone-500 hover:text-stone-800'}`}
            title="Automatic layout matching device size"
          >
            <Sparkles size={8} /> Auto
          </button>
          <button
            onClick={() => setViewMode('desktop')}
            className={`p-1 px-1.5 rounded-md text-[8px] font-bold uppercase transition flex items-center gap-0.5 cursor-pointer ${viewMode === 'desktop' ? 'bg-[#FAF8F5] text-stone-800 shadow-xs font-extrabold border border-stone-300/20' : 'text-stone-500 hover:text-stone-800'}`}
            title="Force widescreen desktop presentation"
          >
            <Monitor size={8} /> Desk
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={`p-1 px-1.5 rounded-md text-[8px] font-bold uppercase transition flex items-center gap-0.5 cursor-pointer ${viewMode === 'mobile' ? 'bg-[#FAF8F5] text-stone-800 shadow-xs font-extrabold border border-stone-300/20' : 'text-stone-500 hover:text-stone-800'}`}
            title="Force native-feeling mobile card presentation"
          >
            <Smartphone size={8} /> Mob
          </button>
        </div>
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
