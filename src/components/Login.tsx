/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Delete, Users, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface LoginProps {
  onUnlock: () => void;
  partnerNames: {
    you: string;
    partner: string;
  };
}

export default function Login({ onUnlock, partnerNames }: LoginProps) {
  const [pin, setPin] = useState<string>('');
  const [errorShake, setErrorShake] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const DEFAULT_PIN = '1234';

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      // Auto-submit when all 4 digits are entered
      if (newPin.length === 4) {
        if (newPin === DEFAULT_PIN) {
          setTimeout(() => {
            onUnlock();
          }, 300);
        } else {
          // Play shake error animation
          setTimeout(() => {
            setErrorShake(true);
            // Shake reset
            setTimeout(() => setErrorShake(false), 500);
            setPin('');
          }, 200);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col justify-center items-center px-4 py-8 select-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-[#EAE4D8] border border-stone-300 rounded-[32px] shadow-xl p-8 flex flex-col items-center space-y-8"
      >
        {/* Brand identity header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 bg-stone-900 text-stone-100 rounded-2xl mb-2 shadow-inner">
            <Lock size={20} className="animate-pulse" />
          </div>
          <h1 className="text-xl font-black font-display text-stone-900 tracking-tight">DINK Finance Engine</h1>
          <p className="text-xs text-stone-500 font-semibold max-w-xs mx-auto">
            Authorized entry only. Access requested for the household database of:
          </p>
        </div>

        {/* Profiles preview to personalize the locked state */}
        <div className="flex items-center gap-3 bg-stone-100/60 border border-stone-200/50 p-3.5 rounded-2xl w-full">
          <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800">
            <Users size={16} />
          </div>
          <div className="flex-1 text-left text-xs font-semibold text-stone-700">
            <div className="font-bold text-stone-500 font-display text-[9px] uppercase tracking-wider mb-0.5">Active Partners</div>
            <div className="text-stone-900 flex items-center gap-1.5 font-display font-extrabold">
              <span>{partnerNames.you}</span>
              <span className="text-stone-300 font-normal">&amp;</span>
              <span>{partnerNames.partner}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-emerald-200/50 border border-emerald-505/10 text-emerald-800 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full font-display">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"></span>
            DINK
          </div>
        </div>

        {/* PIN Dot Indicators */}
        <div className="flex flex-col items-center space-y-4 w-full">
          <motion.div 
            animate={errorShake ? { x: [-10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="flex gap-4 justify-center py-2"
          >
            {[0, 1, 2, 3].map((index) => {
              const isActive = pin.length > index;
              return (
                <motion.div
                  key={index}
                  animate={isActive ? { scale: [1, 1.25, 1], backgroundColor: '#0D9E80' } : { scale: 1, backgroundColor: '#DDD8CE' }}
                  className={`w-4 h-4 rounded-full border border-stone-300 transition duration-150 ${errorShake ? 'bg-red-650 border-red-400' : ''}`}
                />
              );
            })}
          </motion.div>
          
          <AnimatePresence mode="wait">
            {errorShake ? (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-red-650 font-black tracking-tight"
              >
                Incorrect Access PIN. Please try again.
              </motion.div>
            ) : (
              <div className="text-[11px] text-stone-550 font-semibold tracking-tight h-4">
                {pin.length === 4 ? 'Verifying secure state...' : 'Enter 4-digit Household Access PIN'}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* PIN Numeric Entry Keypad (Ensuring touch targets meet 44px min-height perfectly) */}
        <div className="grid grid-cols-3 gap-x-6 gap-y-4 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              id={`pin-btn-${num}`}
              key={num}
              onClick={() => handleKeyPress(num)}
              className="w-16 h-16 rounded-full bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-200 flex items-center justify-center font-bold text-lg font-display transition active:scale-95 shadow-sm"
            >
              {num}
            </button>
          ))}
          
          {/* Backspace / Clear and 0 */}
          <button
            id="pin-btn-clear"
            onClick={handleClear}
            className="w-16 h-16 rounded-full text-stone-500 hover:text-stone-800 text-[10px] uppercase font-bold font-display transition active:scale-95 flex items-center justify-center"
          >
            Clear
          </button>
          
          <button
            id="pin-btn-0"
            onClick={() => handleKeyPress('0')}
            className="w-16 h-16 rounded-full bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-200 flex items-center justify-center font-bold text-lg font-display transition active:scale-95 shadow-sm"
          >
            0
          </button>
          
          <button
            id="pin-btn-back"
            onClick={handleBackspace}
            aria-label="Delete last digit"
            className="w-16 h-16 rounded-full text-stone-500 hover:text-stone-850 flex items-center justify-center transition active:scale-95"
          >
            <Delete size={18} />
          </button>
        </div>

        {/* Default Credential Safe Hint */}
        <div className="pt-2 border-t border-stone-300 w-full flex flex-col items-center">
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="text-[10px] text-stone-400 hover:text-stone-600 transition font-bold uppercase tracking-wider font-display flex items-center gap-1.5"
          >
            <span>Need default credentials?</span>
            <span className="underline">{showHint ? 'Hide details' : 'Show PIN info'}</span>
          </button>

          <AnimatePresence>
            {showHint && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-2 text-center text-[10px] text-stone-520 font-medium leading-relaxed bg-[#F0EAE0]/50 p-2.5 rounded-xl border border-stone-250 w-full"
              >
                🗝️ Use the system default PIN <strong>1234</strong> to sign into the secure household workspace. Setup is saved in your local sandbox browser.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
