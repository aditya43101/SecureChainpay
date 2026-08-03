"use client";

import { Eye, EyeOff, TrendingUp, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useWalletStore } from '@/stores/wallet-store';

export function WalletCard() {
  const { balances, address } = useWalletStore();
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative p-6 sm:p-10 rounded-[2rem] overflow-hidden group min-h-[320px] flex flex-col justify-between border border-white/5 shadow-2xl">
      {/* Background with mesh gradient */}
      <div className="absolute inset-0 bg-neutral-900 z-0" />
      <div className="absolute top-[-20%] right-[-10%] w-[80%] h-[80%] bg-emerald-500/20 rounded-full blur-[100px] group-hover:bg-emerald-500/30 transition-colors duration-700" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[80%] h-[80%] bg-cyan-600/20 rounded-full blur-[100px]" />
      
      {/* Decorative Chart Line in Background */}
      <div className="absolute bottom-0 right-0 w-full h-[60%] opacity-30 pointer-events-none z-0">
        <svg viewBox="0 0 400 150" className="w-full h-full stroke-emerald-500" preserveAspectRatio="none" fill="none">
          <path d="M0,150 C40,120 80,130 120,90 C160,50 200,80 240,60 C280,40 320,20 400,0" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <path d="M0,150 C40,120 80,130 120,90 C160,50 200,80 240,60 C280,40 320,20 400,0 L400,150 L0,150 Z" fill="url(#gradient)" stroke="none" />
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between gap-10">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-neutral-300">
              <span className="text-base font-medium">Total Portfolio Value</span>
              <button 
                onClick={() => setShowBalance(!showBalance)}
                className="hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
              >
                {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-5xl sm:text-6xl font-black text-white tracking-tight drop-shadow-md">
                {showBalance ? `$${(balances.USD + balances.ETH * 3000 + balances.BTC * 60000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')[0]}` : '••••••'}
                {showBalance && <span className="text-3xl text-neutral-400 font-bold ml-1">.{((balances.USD + balances.ETH * 3000 + balances.BTC * 60000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')[1])}</span>}
              </h2>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-3">
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8 bg-neutral-950/40 p-5 rounded-2xl border border-white/5 backdrop-blur-md">
          <div className="flex-1">
            <p className="text-sm text-neutral-400 font-medium mb-1">Crypto Assets</p>
            <p className="text-xl font-bold text-white">{showBalance ? `$${(balances.ETH * 3000 + balances.BTC * 60000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'}</p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-white/10" />
          <div className="flex-1">
            <p className="text-sm text-neutral-400 font-medium mb-1">Fiat Balance</p>
            <p className="text-xl font-bold text-white">{showBalance ? `$${balances.USD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'}</p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-white/10" />
          
          {/* Wallet Address Chip */}
          <button 
            onClick={handleCopy}
            className="flex items-center justify-between sm:justify-start gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-neutral-200 transition-all group/btn w-full sm:w-auto"
          >
            <span className="font-mono tracking-wider">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Loading...'}</span>
            {copied ? (
              <Check size={16} className="text-emerald-400" />
            ) : (
              <Copy size={16} className="text-neutral-500 group-hover/btn:text-white transition-colors" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
