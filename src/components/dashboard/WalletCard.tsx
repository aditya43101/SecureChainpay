"use client";

import { Eye, EyeOff, TrendingUp, Copy, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWalletStore, USD_TO_HSCT } from '@/stores/wallet-store';

export function WalletCard() {
  const { balances, detailedBalances, fetchDetailedBalances, address, prices } = useWalletStore();
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Sync detailed balances when wallet address is ready
  useEffect(() => {
    if (address) {
      fetchDetailedBalances(address).catch(() => null);
    }
  }, [address, fetchDetailedBalances]);

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentHsct = Number((balances.HSCT && balances.HSCT > 0) ? balances.HSCT : ((balances.USD && balances.USD > 0) ? balances.USD * USD_TO_HSCT : 0));
  const cryptoHsct = (balances.ETH * prices.ETH + balances.BTC * prices.BTC) * USD_TO_HSCT;
  const lifetimeHsct = currentHsct + cryptoHsct;

  // 5-Way Balance Accounting
  const totalBalance = detailedBalances?.total > 0 ? detailedBalances.total : lifetimeHsct;
  const availableBalance = detailedBalances?.available !== undefined ? detailedBalances.available : currentHsct;
  const reservedBalance = detailedBalances?.reserved || 0;
  const processingBalance = detailedBalances?.processing || 0;
  const onchainLocked = detailedBalances?.onchainLocked || 0;
  const offchainReserved = detailedBalances?.offchainReserved || 0;

  return (
    <div className="relative p-6 sm:p-8 md:p-10 rounded-3xl overflow-hidden group min-h-[300px] sm:min-h-[340px] flex flex-col justify-between bg-[#0a0a0a] border border-[#FEEF8B]/20 shadow-2xl">
      {/* Background ambient lighting */}
      <div className="absolute top-[-25%] right-[-10%] w-[70%] h-[70%] bg-[#FEEF8B]/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-[#FEEF8B]/15 transition-colors duration-700" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#F5C542]/5 rounded-full blur-[90px] pointer-events-none" />
      
      {/* Decorative chart vector */}
      <div className="absolute bottom-0 right-0 w-full h-[50%] opacity-20 pointer-events-none z-0">
        <svg viewBox="0 0 400 150" className="w-full h-full stroke-[#FEEF8B]" preserveAspectRatio="none" fill="none">
          <path d="M0,130 C50,110 90,125 140,80 C180,45 220,70 260,50 C300,30 350,15 400,5" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          <path d="M0,130 C50,110 90,125 140,80 C180,45 220,70 260,50 C300,30 350,15 400,5 L400,150 L0,150 Z" fill="url(#yellowGradient)" stroke="none" />
          <defs>
            <linearGradient id="yellowGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FEEF8B" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#FEEF8B" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between gap-6 sm:gap-8">
        {/* Top Balance Area */}
        <div className="flex items-start justify-between">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 text-neutral-400">
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider">Total Balance</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Anchored PoA
              </span>
              <button 
                onClick={() => setShowBalance(!showBalance)}
                className="hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 min-h-[32px] min-w-[32px] flex items-center justify-center text-neutral-400"
                aria-label={showBalance ? "Hide balance" : "Show balance"}
              >
                {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <div className="flex items-baseline flex-wrap gap-1">
              <h2 className="text-3xl xs:text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight break-all">
                {showBalance ? `${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')[0]}` : '••••••'}
                {showBalance && (
                  <span className="text-xl sm:text-3xl text-neutral-400 font-bold ml-0.5">
                    .{totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')[1]}
                  </span>
                )}
                {showBalance && (
                  <span className="text-sm sm:text-lg font-extrabold text-[#FEEF8B] ml-2 px-2 py-0.5 bg-[#FEEF8B]/10 rounded-lg border border-[#FEEF8B]/20">
                    HSCT
                  </span>
                )}
              </h2>
            </div>

            {/* 5-Way Concept Accounting Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <div className="px-2.5 py-1 bg-white/[0.04] border border-white/10 rounded-lg flex items-center gap-1.5">
                <span className="text-neutral-400">Available:</span>
                <span className="text-[#FEEF8B] font-bold font-mono">
                  {showBalance ? `${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT` : '••••••'}
                </span>
              </div>

              {reservedBalance > 0 && (
                <div className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-1.5 text-amber-400">
                  <span>Reserved:</span>
                  <span className="font-bold font-mono">
                    {showBalance ? `${reservedBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••'}
                  </span>
                  <span className="text-[10px] text-amber-300/80">
                    ({onchainLocked > 0 ? `⛓ Locked: ${onchainLocked}` : ''}{onchainLocked > 0 && offchainReserved > 0 ? ' | ' : ''}{offchainReserved > 0 ? `⏳ Queue: ${offchainReserved}` : ''})
                  </span>
                </div>
              )}

              {processingBalance > 0 && (
                <div className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-1.5 text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                  <span>In-Flight:</span>
                  <span className="font-bold font-mono">{processingBalance.toLocaleString()} HSCT</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sub Assets & Address Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 bg-black/80 p-4 sm:p-5 rounded-2xl border border-white/5 backdrop-blur-md">
          {/* Crypto Value */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-0.5">Crypto Value</p>
            <p className="text-base sm:text-lg font-extrabold text-white truncate">
              {showBalance ? `${cryptoHsct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT` : '••••••'}
            </p>
          </div>

          <div className="hidden sm:block w-px h-8 bg-white/10" />

          {/* Tokens Breakdown */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-0.5">Holdings</p>
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-300">
              <span className="text-neutral-400">BTC:</span> <span className="font-bold text-white">{showBalance ? balances.BTC : '••'}</span>
              <span className="text-neutral-600">|</span>
              <span className="text-neutral-400">ETH:</span> <span className="font-bold text-white">{showBalance ? balances.ETH : '••'}</span>
            </div>
          </div>

          <div className="hidden sm:block w-px h-8 bg-white/10" />
          
          {/* Wallet Address Chip */}
          <button 
            onClick={handleCopy}
            className="flex items-center justify-between sm:justify-start gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-xs font-medium text-neutral-300 hover:text-white transition-all group/btn w-full sm:w-auto min-h-[44px]"
            title="Click to copy public wallet address"
          >
            <span className="font-mono tracking-wide">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Loading...'}</span>
            {copied ? (
              <span className="flex items-center gap-1 text-[#FEEF8B] text-[11px] font-bold">
                <Check size={14} /> Copied
              </span>
            ) : (
              <Copy size={14} className="text-neutral-500 group-hover/btn:text-[#FEEF8B] transition-colors flex-shrink-0" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
