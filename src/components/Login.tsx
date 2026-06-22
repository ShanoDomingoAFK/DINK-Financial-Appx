import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  Users, 
  AlertCircle, 
  Loader2, 
  Mail, 
  Key, 
  UserPlus, 
  Unlock,
  Sparkles,
  Link as LinkIcon,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Laptop
} from 'lucide-react';
import { supabase, SUPABASE_TABLE } from '../supabase';
import { INITIAL_STATE } from '../utils';

export const AVATAR_PRESETS = [
  { id: 'av_man1', emoji: '👨‍🚀', gradient: 'from-sky-400 to-indigo-600', label: 'Techie' },
  { id: 'av_woman1', emoji: '👩‍🎨', gradient: 'from-pink-400 to-rose-600', label: 'Artist' },
  { id: 'av_man2', emoji: '👨‍💼', gradient: 'from-emerald-400 to-teal-600', label: 'Executive' },
  { id: 'av_woman2', emoji: '👩‍🍳', gradient: 'from-amber-400 to-orange-600', label: 'Culinary' },
  { id: 'av_cat', emoji: '🐈', gradient: 'from-violet-400 to-purple-600', label: 'Feline' },
  { id: 'av_dog', emoji: '🐕', gradient: 'from-yellow-400 to-amber-600', label: 'Canine' },
  { id: 'av_traveler', emoji: '✈️', gradient: 'from-cyan-400 to-sky-600', label: 'Traveler' },
  { id: 'av_heart', emoji: '❤️', gradient: 'from-red-400 to-pink-500', label: 'Union' }
];

interface LoginProps {
  onUnlock: (
    partnerData?: { you: string; partner: string; youPic?: string; partnerPic?: string },
    authenticatedUser?: any
  ) => void;
  partnerNames: {
    you: string;
    partner: string;
    youPic?: string;
    partnerPic?: string;
  };
}

export default function Login({ onUnlock, partnerNames }: LoginProps) {
  // Mode: 'login' | 'register' | 'pin'
  const [mode, setMode] = useState<'login' | 'register' | 'pin'>('pin');
  
  // PIN states
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);
  const [pinEmail, setPinEmail] = useState('');
  const [pinStep, setPinStep] = useState<1 | 2>(1); // 1: Email verify, 2: Keypad entry

  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerPin, setRegisterPin] = useState('');
  const [p1Name, setP1Name] = useState('Aiden');
  const [p2Name, setP2Name] = useState('Chloe');
  const [p1Pic, setP1Pic] = useState('av_man1');
  const [p2Pic, setP2Pic] = useState('av_woman1');
  
  // Custom URL states
  const [p1CustomUrl, setP1CustomUrl] = useState('');
  const [p2CustomUrl, setP2CustomUrl] = useState('');
  const [showP1CustomInput, setShowP1CustomInput] = useState(false);
  const [showP2CustomInput, setShowP2CustomInput] = useState(false);

  // Flow State
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. PIN Keypad Handler
  const handlePinPress = async (num: string) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === 6) {
        setLoading(true);
        setErrorMsg('');
        try {
          if (!supabase) {
            throw new Error('Supabase is not configured.');
          }

          // Query user pin row
          const { data, error } = await supabase
            .from('dink_user_pins')
            .select('*')
            .eq('email', pinEmail.trim().toLowerCase())
            .eq('pin', newPin)
            .maybeSingle();

          if (error) throw error;

          if (!data) {
            setTimeout(() => {
              setPinError(true);
              setErrorMsg('Incorrect PIN code. Please try again.');
              setTimeout(() => setPinError(false), 500);
              setPin('');
              setLoading(false);
            }, 150);
          } else {
            // Correct PIN! Fetch state to unlock
            const docId = `user_${data.user_id}`;
            const { data: stateData, error: stateErr } = await supabase
              .from(SUPABASE_TABLE)
              .select('state')
              .eq('id', docId)
              .maybeSingle();

            let pData = undefined;
            if (!stateErr && stateData?.state) {
              const meta = stateData.state.partnerNames || {};
              pData = {
                you: meta.you || 'Aiden',
                partner: meta.partner || 'Chloe',
                youPic: meta.youPic || 'av_man1',
                partnerPic: meta.partnerPic || 'av_woman1'
              };
            }

            setSuccessMsg('Account unlocked successfully!');
            setTimeout(() => {
              onUnlock(pData, { id: data.user_id, email: data.email });
              setLoading(false);
            }, 1000);
          }
        } catch (err: any) {
          setErrorMsg(err.message || 'Verification failed. Make sure your email is registered and pin setup is complete.');
          setPin('');
          setLoading(false);
        }
      }
    }
  };

  // 2. Supabase Log In
  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMsg('Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your env/secrets.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        // Retrieve optional metadata to override names
        const meta = data.user.user_metadata || {};
        const you = meta.partnerNames?.you || 'Aiden';
        const partner = meta.partnerNames?.partner || 'Chloe';
        const youPic = meta.partnerNames?.youPic || 'av_man1';
        const partnerPic = meta.partnerNames?.partnerPic || 'av_woman1';
        
        onUnlock({ you, partner, youPic, partnerPic }, data.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate secure session');
    } finally {
      setLoading(false);
    }
  };

  // 3. Supabase Sign Up Wizard
  const handleSupabaseSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMsg('Supabase is not configured.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    const finalP1Pic = showP1CustomInput ? p1CustomUrl.trim() : p1Pic;
    const finalP2Pic = showP2CustomInput ? p2CustomUrl.trim() : p2Pic;

    try {
      // Create authentic login profile
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            partnerNames: {
              you: p1Name.trim() || 'Aiden',
              partner: p2Name.trim() || 'Chloe',
              youPic: finalP1Pic || 'av_man1',
              partnerPic: finalP2Pic || 'av_woman1'
            }
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Initialize dynamic database record with names and selected template state
        const initialCustomState = {
          ...INITIAL_STATE,
          partnerNames: {
            you: p1Name.trim() || 'Aiden',
            partner: p2Name.trim() || 'Chloe',
            youPic: finalP1Pic || 'av_man1',
            partnerPic: finalP2Pic || 'av_woman1'
          }
        };

        // Non-destructive initialization: Uses insert to avoid wiping existing records if they registered again
        const { error: insertErr } = await supabase
          .from(SUPABASE_TABLE)
          .insert({
            id: `user_${data.user.id}`,
            state: initialCustomState,
            updated_at: new Date().toISOString()
          });

        if (insertErr) {
          console.warn('Metadata setup note (might already exist):', insertErr);
        }

        // Create matching PIN row in dink_user_pins
        const { error: pinErr } = await supabase
          .from('dink_user_pins')
          .upsert({
            email: email.trim().toLowerCase(),
            pin: registerPin,
            user_id: data.user.id,
            updated_at: new Date().toISOString()
          });

        if (pinErr) {
          console.warn('Could not insert PIN mapping during registration:', pinErr);
        }

        setSuccessMsg('Account registered successfully! Attempting workspace unlock...');
        setTimeout(() => {
          onUnlock({
            you: p1Name.trim(),
            partner: p2Name.trim(),
            youPic: finalP1Pic,
            partnerPic: finalP2Pic
          }, { id: data.user.id, email: data.user.email });
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not provision new cloud credentials');
    } finally {
      setLoading(false);
    }
  };

  const renderPresetPreview = (picId: string) => {
    const preset = AVATAR_PRESETS.find(p => p.id === picId);
    if (preset) {
      return (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg bg-gradient-to-tr ${preset.gradient} text-white shadow`}>
          {preset.emoji}
        </div>
      );
    }
    // Is custom URL
    if (picId.startsWith('http') || picId.startsWith('data:image')) {
      return (
        <img src={picId} alt="Custom Preview" className="w-10 h-10 rounded-full object-cover border border-stone-300 shadow" referrerPolicy="no-referrer" />
      );
    }
    return <div className="w-10 h-10 rounded-full bg-stone-300 flex items-center justify-center">👤</div>;
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col justify-center items-center px-4 py-8 select-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md bg-[#EAE4D8] border border-stone-300 rounded-[32px] shadow-xl p-6 md:p-8 flex flex-col items-center space-y-6"
      >
        {/* Brand identity header */}
        <div className="text-center space-y-2 w-full">
          <div className="inline-flex p-3 bg-stone-900 text-stone-100 rounded-2xl mb-1 shadow-inner">
            {supabase ? <Sparkles size={20} className="text-teal-400 animate-pulse" /> : <Lock size={20} />}
          </div>
          <h1 className="text-xl font-black font-display text-stone-900 tracking-tight">DINK Finance Engine</h1>
          
          {/* Authentic Tab Selectors */}
          <div className="flex bg-stone-200/60 p-1 rounded-xl border border-stone-300/40 w-full mt-4">
            <button
              onClick={() => { setMode('pin'); setErrorMsg(''); setPinStep(1); setPin(''); }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-extrabold uppercase tracking-wide font-display transition ${mode === 'pin' ? 'bg-[#FAF8F5] text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-850'}`}
            >
              PIN Login
            </button>
            <button
              onClick={() => { setMode('login'); setErrorMsg(''); }}
              disabled={!supabase}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-extrabold uppercase tracking-wide font-display transition relative ${mode === 'login' ? 'bg-[#FAF8F5] text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-850'} disabled:opacity-50`}
            >
              Password Login
              {!supabase && <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span></span>}
            </button>
            <button
              onClick={() => { setMode('register'); setErrorMsg(''); setRegStep(1); }}
              disabled={!supabase}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-extrabold uppercase tracking-wide font-display transition relative ${mode === 'register' ? 'bg-[#FAF8F5] text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-850'} disabled:opacity-50`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="w-full bg-red-100 border border-red-200 rounded-xl p-3 flex gap-2 text-red-800 text-xs font-semibold">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && (
          <div className="w-full bg-emerald-100 border border-emerald-200 rounded-xl p-3 flex gap-2 text-emerald-800 text-xs font-semibold">
            <Unlock size={15} className="shrink-0 mt-0.5" />
            <div>{successMsg}</div>
          </div>
        )}

        {/* ─── TAB 1: SECURE 6-DIGIT PIN LOGIN ─── */}
        {mode === 'pin' && (
          <div className="w-full">
            {pinStep === 1 ? (
              <form 
                onSubmit={(e) => { 
                  e.preventDefault(); 
                  if (pinEmail.trim()) {
                    setPinStep(2); 
                    setErrorMsg('');
                  } else {
                    setErrorMsg('Please enter your email address.');
                  }
                }} 
                className="w-full space-y-4"
              >
                <div className="text-center">
                  <p className="text-xs text-stone-500 font-bold uppercase tracking-wider font-display mb-1 text-teal-800">Secure PIN Verification</p>
                  <p className="text-[11px] text-stone-500 font-semibold max-w-xs mx-auto">
                    Enter your registered household email address to enable the secure PIN keypad.
                  </p>
                </div>

                <div className="space-y-1.5 text-xs text-stone-700 font-semibold">
                  <label className="text-[10px] font-extrabold uppercase tracking-wide text-stone-450 font-display flex items-center gap-1">
                    <Mail size={12} /> Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@household.com"
                    value={pinEmail}
                    onChange={e => setPinEmail(e.target.value)}
                    className="w-full text-xs font-semibold border border-stone-300 rounded-xl p-2.5 outline-none focus:border-stone-500 bg-stone-50/50"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 mt-5 bg-stone-900 hover:bg-stone-850 text-white font-extrabold rounded-xl text-xs uppercase tracking-wide inline-flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                >
                  <span>Continue to PIN Keypad</span>
                  <ChevronRight size={14} />
                </button>
              </form>
            ) : (
              <div className="w-full flex flex-col items-center space-y-6">
                <div className="text-center">
                  <p className="text-xs text-stone-500 font-bold uppercase tracking-wider font-display mb-1 text-teal-800">Enter PIN Code</p>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500 font-semibold">
                    <span>Logging in as: <strong>{pinEmail}</strong></span>
                    <button
                      type="button"
                      onClick={() => { setPinStep(1); setPin(''); }}
                      className="text-xs text-teal-850 hover:underline font-bold"
                    >
                      (change)
                    </button>
                  </div>
                </div>

                {/* PIN Dot Indicators */}
                <div className="flex flex-col items-center space-y-2 w-full">
                  <motion.div 
                    animate={pinError ? { x: [-10, 10, -10, 10, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className="flex gap-4 justify-center py-2"
                  >
                    {[0, 1, 2, 3, 4, 5].map((index) => {
                      const isActive = pin.length > index;
                      return (
                        <motion.div
                          key={index}
                          animate={isActive ? { scale: [1, 1.25, 1], backgroundColor: '#0D9E80' } : { scale: 1, backgroundColor: '#DDD8CE' }}
                          className={`w-3.5 h-3.5 rounded-full border border-stone-300 transition duration-150 ${pinError ? 'bg-red-500 border-red-400' : ''}`}
                        />
                      );
                    })}
                  </motion.div>
                  <div className="text-[10px] text-stone-500 font-bold">
                    {pin.length === 6 ? 'Unlocking secure vault...' : 'Enter your 6-digit PIN Code'}
                  </div>
                </div>

                {/* PIN Numeric Entry Keypad */}
                <div className="grid grid-cols-3 gap-x-6 gap-y-3 w-full max-w-[260px]">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePinPress(num)}
                      disabled={loading}
                      className="w-14 h-14 rounded-full bg-[#FAF8F5] hover:bg-stone-50 text-stone-850 border border-stone-200 flex items-center justify-center font-bold text-md font-display transition active:scale-95 shadow-xs shrink-0 disabled:opacity-50"
                    >
                      {num}
                    </button>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => setPin('')}
                    disabled={loading}
                    className="w-14 h-14 text-stone-400 hover:text-stone-700 text-[10px] uppercase font-bold font-display transition active:scale-95 flex items-center justify-center shrink-0"
                  >
                    Reset
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handlePinPress('0')}
                    disabled={loading}
                    className="w-14 h-14 rounded-full bg-[#FAF8F5] hover:bg-stone-50 text-stone-850 border border-stone-200 flex items-center justify-center font-bold text-md font-display transition active:scale-95 shadow-xs shrink-0 disabled:opacity-50"
                  >
                    0
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setPin(prev => prev.slice(0, -1))}
                    disabled={loading}
                    aria-label="Delete last digit"
                    className="w-14 h-14 text-stone-400 hover:text-stone-700 font-bold font-display transition active:scale-95 flex items-center justify-center shrink-0"
                  >
                    ⌫
                  </button>
                </div>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setErrorMsg(''); }}
                    className="text-xs font-bold text-teal-800 hover:underline"
                  >
                    Forgot PIN? Log in with Password instead
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: SUPABASE PASSWORD SIGN IN ─── */}
        {mode === 'login' && (
          <form onSubmit={handleSupabaseLogin} className="w-full space-y-4">
            <div className="text-center">
              <p className="text-xs text-stone-500 font-bold uppercase tracking-wider font-display mb-1 text-teal-800">Password Login</p>
              <p className="text-[11px] text-stone-500 font-semibold max-w-xs mx-auto">
                Sign into your household with your email and password.
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1.5 text-xs text-stone-700 font-semibold">
                <label className="text-[10px] font-extrabold uppercase tracking-wide text-stone-450 font-display flex items-center gap-1">
                  <Mail size={12} /> Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@household.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full text-xs font-semibold border border-stone-300 rounded-xl p-2.5 outline-none focus:border-stone-500 bg-stone-50/50"
                />
              </div>

              <div className="space-y-1.5 text-xs text-stone-700 font-semibold">
                <label className="text-[10px] font-extrabold uppercase tracking-wide text-stone-450 font-display flex items-center gap-1">
                  <Key size={12} /> Account Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full text-xs font-semibold border border-stone-300 rounded-xl p-2.5 outline-none focus:border-stone-500 bg-stone-50/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 mt-5 bg-stone-900 hover:bg-stone-850 text-white font-extrabold rounded-xl text-xs uppercase tracking-wide inline-flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin text-teal-400" />
                  <span>Unlocking Cloud Vault...</span>
                </>
              ) : (
                <>
                  <Unlock size={14} />
                  <span>Log In with Password</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ─── TAB 3: SUPABASE HOUSEHOLD REGISTRATION ─── */}
        {mode === 'register' && (
          <div className="w-full">
            <div className="text-center mb-4">
              <p className="text-xs text-stone-500 font-bold uppercase tracking-wider font-display mb-1 text-teal-800">
                Step {regStep} of 2 (Custom Household Portal)
              </p>
              <p className="text-[11px] text-stone-500 font-semibold">
                {regStep === 1 
                  ? 'Establish private login credentials for your DINK account.' 
                  : 'Customize your partner names and profiles with beautiful avatars!'
                }
              </p>
            </div>

            {/* STEP 1: LOGIN DETAILS */}
            {regStep === 1 ? (
              <form onSubmit={(e) => { 
                e.preventDefault(); 
                if (registerPin.length !== 6 || !/^\d+$/.test(registerPin)) {
                  setErrorMsg('Please specify a 6-digit numeric PIN code.');
                  return;
                }
                setRegStep(2); 
                setErrorMsg('');
              }} className="space-y-4">
                <div className="space-y-3.5">
                  <div className="space-y-1.5 text-xs text-stone-700 font-semibold">
                    <label className="text-[10px] font-extrabold uppercase tracking-wide text-stone-450 font-display flex items-center gap-1">
                      <Mail size={12} /> Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. dynamic@couple.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full text-xs font-semibold border border-stone-300 rounded-xl p-2.5 outline-none focus:border-stone-500 bg-stone-50/50"
                    />
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-700 font-semibold">
                    <label className="text-[10px] font-extrabold uppercase tracking-wide text-stone-450 font-display flex items-center gap-1">
                      <Key size={12} /> Account Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Min 6 characters"
                      minLength={6}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full text-xs font-semibold border border-stone-300 rounded-xl p-2.5 outline-none focus:border-stone-500 bg-stone-50/50"
                    />
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-700 font-semibold">
                    <label className="text-[10px] font-extrabold uppercase tracking-wide text-stone-450 font-display flex items-center gap-1">
                      <Lock size={12} strokeWidth={2.5} className="text-teal-600" /> Appoint 6-Digit Login PIN
                    </label>
                    <input
                      type="text"
                      required
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="e.g. 123456"
                      value={registerPin}
                      onChange={e => setRegisterPin(e.target.value.replace(/\D/g, '').substring(0, 6))}
                      className="w-full text-xs font-semibold border border-stone-350 rounded-xl p-2.5 outline-none focus:border-emerald-600 bg-emerald-50/50 tracking-widest text-center text-lg font-mono focus:bg-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 mt-4 bg-stone-900 hover:bg-stone-850 text-white font-extrabold rounded-xl text-xs uppercase tracking-wide inline-flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                >
                  <span>Set Up Profiles</span>
                  <ChevronRight size={14} />
                </button>
              </form>
            ) : (
              /* STEP 2: PROFILE NAMES & PICTURES */
              <form onSubmit={handleSupabaseSignUp} className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {/* PARTNER 1 (YOU) */}
                <div className="bg-[#FAF8F5]/80 p-3.5 rounded-2xl border border-stone-300/40 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-800 text-[10px] font-display">1</div>
                    <span className="text-[11px] font-black uppercase tracking-wide text-stone-850 font-display">Partner 1 Profile (You)</span>
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-700 font-semibold">
                    <label className="text-[9px] font-extrabold uppercase tracking-wide text-stone-400 font-display">Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aiden"
                      value={p1Name}
                      onChange={e => setP1Name(e.target.value)}
                      className="w-full text-xs border border-stone-300 rounded-xl p-2 bg-white"
                    />
                  </div>

                  {/* Partner 1 Avatars Selection */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-extrabold uppercase tracking-wide text-stone-450 font-display">Select Avatar or Picture</span>
                      <button 
                        type="button" 
                        onClick={() => setShowP1CustomInput(!showP1CustomInput)}
                        className="text-[9px] font-bold text-teal-800 hover:underline flex items-center gap-0.5"
                      >
                        <LinkIcon size={10} /> {showP1CustomInput ? 'Preset avatars' : 'Paste photo URL'}
                      </button>
                    </div>

                    {showP1CustomInput ? (
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/your-photo.jpg"
                        value={p1CustomUrl}
                        onChange={e => setP1CustomUrl(e.target.value)}
                        className="w-full text-[10px] border border-stone-300 rounded-xl p-2 bg-white"
                      />
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {AVATAR_PRESETS.map((preset) => {
                          const isSel = p1Pic === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setP1Pic(preset.id)}
                              className={`p-1.5 rounded-xl flex flex-col items-center gap-1 border transition ${isSel ? 'bg-emerald-100/70 border-emerald-500/35 ring-1 ring-emerald-500/20' : 'bg-white border-stone-200 hover:bg-stone-50'}`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm bg-gradient-to-tr ${preset.gradient} text-white shadow`}>
                                {preset.emoji}
                              </div>
                              <span className="text-[8px] font-semibold text-stone-500 truncate w-full text-center">{preset.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* PARTNER 2 */}
                <div className="bg-[#FAF8F5]/80 p-3.5 rounded-2xl border border-stone-300/40 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-800 text-[10px] font-display">2</div>
                    <span className="text-[11px] font-black uppercase tracking-wide text-stone-850 font-display">Partner 2 Profile</span>
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-700 font-semibold">
                    <label className="text-[9px] font-extrabold uppercase tracking-wide text-stone-400 font-display">Partner name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Chloe"
                      value={p2Name}
                      onChange={e => setP2Name(e.target.value)}
                      className="w-full text-xs border border-stone-300 rounded-xl p-2 bg-white"
                    />
                  </div>

                  {/* Partner 2 Avatars Selection */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-extrabold uppercase tracking-wide text-stone-450 font-display">Select Avatar or Picture</span>
                      <button 
                        type="button" 
                        onClick={() => setShowP2CustomInput(!showP2CustomInput)}
                        className="text-[9px] font-bold text-teal-800 hover:underline flex items-center gap-0.5"
                      >
                        <LinkIcon size={10} /> {showP2CustomInput ? 'Preset avatars' : 'Paste photo URL'}
                      </button>
                    </div>

                    {showP2CustomInput ? (
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/partner-photo.jpg"
                        value={p2CustomUrl}
                        onChange={e => setP2CustomUrl(e.target.value)}
                        className="w-full text-[10px] border border-stone-300 rounded-xl p-2 bg-white"
                      />
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {AVATAR_PRESETS.map((preset) => {
                          const isSel = p2Pic === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setP2Pic(preset.id)}
                              className={`p-1.5 rounded-xl flex flex-col items-center gap-1 border transition ${isSel ? 'bg-indigo-100/70 border-indigo-505/35 ring-1 ring-indigo-550/25' : 'bg-white border-stone-200 hover:bg-stone-50'}`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm bg-gradient-to-tr ${preset.gradient} text-white shadow`}>
                                {preset.emoji}
                              </div>
                              <span className="text-[8px] font-semibold text-stone-500 truncate w-full text-center">{preset.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="flex-1 py-2 px-3 bg-stone-200 hover:bg-stone-300 rounded-xl text-xs font-black uppercase tracking-wide inline-flex items-center justify-center gap-1 transition text-stone-700"
                  >
                    <ChevronLeft size={14} />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-2 py-2 px-4 bg-teal-800 hover:bg-teal-900 text-white font-black uppercase tracking-wide rounded-xl text-xs inline-flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Registering...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Registration</span>
                        <Unlock size={12} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
