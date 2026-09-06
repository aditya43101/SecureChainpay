"use client";

import { Eye, EyeOff, TrendingUp, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useWalletStore, USD_TO_HSCT } from '@/stores/wallet-store';

export function WalletCard() {
  const { balances, address, prices } = useWalletStore();
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cryptoHsct = (balances.ETH * prices.ETH + balances.BTC * prices.BTC) * USD_TO_HSCT;
  const fiatHsct = (balances.USD || 0) * USD_TO_HSCT; // Current spendable HSCT balance
  const lifetimeFiatHsct = (balances.lifetimeDeposited ?? balances.USD ?? 0) * USD_TO_HSCT;
  // Overview shows lifetime deposited + crypto in HSCT
  const lifetimeHsct = lifetimeFiatHsct + cryptoHsct;
  const spendableHsct = fiatHsct; // What user can actually spend right now

  return (
    <div className="relative p-5 sm:p-8 md:p-10 rounded-[2rem] overflow-hidden group min-h-[300px] sm:min-h-[320px] flex flex-col justify-between border border-white/5 shadow-2xl">
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

      <div className="relative z-10 flex flex-col h-full justify-between gap-6 sm:gap-10">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5 sm:space-y-2 min-w-0">
            <div className="flex items-center gap-2 text-neutral-300">
              <span className="text-xs sm:text-base font-medium">Total Portfolio Value (HSCT)</span>
              <button 
                onClick={() => setShowBalance(!showBalance)}
                className="hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 min-h-[32px] min-w-[32px] flex items-center justify-center"
                aria-label={showBalance ? "Hide balance" : "Show balance"}
              >
                {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            <div className="flex items-baseline flex-wrap gap-1">
              <h2 className="text-3xl xs:text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight drop-shadow-md break-all">
                {showBalance ? `${lifetimeHsct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')[0]}` : '••••••'}
                {showBalance && <span className="text-xl sm:text-3xl text-neutral-400 font-bold ml-0.5">.{lifetimeHsct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')[1]}</span>}
                {showBalance && <span className="text-base sm:text-xl text-neutral-500 font-bold ml-1.5">HSCT</span>}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 font-medium">
              Spendable Balance: <span className="text-emerald-400 font-semibold">{showBalance ? `${spendableHsct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT` : '••••••'}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 lg:gap-8 bg-neutral-950/40 p-4 sm:p-5 rounded-2xl border border-white/5 backdrop-blur-md">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-neutral-400 font-medium mb-0.5 sm:mb-1">Crypto Value</p>
            <p className="text-lg sm:text-xl font-bold text-white truncate">{showBalance ? `${cryptoHsct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT` : '••••••'}</p>
          </div>
          <div className="hidden sm:block w-px h-8 bg-white/10" />
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-neutral-400 font-medium mb-0.5 sm:mb-1">Fiat Balance (hSCT)</p>
            <p className="text-lg sm:text-xl font-bold text-white truncate">{showBalance ? `${fiatHsct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT` : '••••••'}</p>
          </div>
          <div className="hidden sm:block w-px h-8 bg-white/10" />
          
          {/* Wallet Address Chip */}
          <button 
            onClick={handleCopy}
            className="flex items-center justify-between sm:justify-start gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs sm:text-sm font-medium text-neutral-200 transition-all group/btn w-full sm:w-auto min-h-[44px]"
            title="Click to copy wallet address"
          >
            <span className="font-mono tracking-wider">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Loading...'}</span>
            {copied ? (
              <Check size={16} className="text-emerald-400 flex-shrink-0" />
            ) : (
              <Copy size={16} className="text-neutral-500 group-hover/btn:text-white transition-colors flex-shrink-0" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
