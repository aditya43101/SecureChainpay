'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import TransactionList from '@/components/transactions/TransactionList';
import { useWalletStore, USD_TO_HSCT } from '@/stores/wallet-store';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  ShieldCheck,
  Plus,
  RefreshCw,
  Coins,
  Cpu,
  Layers,
  Lock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

export default function WalletPage() {
  const { address, publicKey, balances, transactions, executeTransaction, prices } = useWalletStore();

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const currentHsct = Number(
    balances.HSCT && balances.HSCT > 0
      ? balances.HSCT
      : balances.USD && balances.USD > 0
      ? balances.USD * USD_TO_HSCT
      : 0
  );

  const ethBalance = Number(balances.ETH || 0);
  const btcBalance = Number(balances.BTC || 0);
  const ethPrice = prices?.ETH || 2600;
  const btcPrice = prices?.BTC || 64000;

  // Total HSCT portfolio value (1 HSCT = 1 INR)
  const cryptoHsct = (ethBalance * ethPrice + btcBalance * btcPrice) * USD_TO_HSCT;
  const totalBalanceHsct = currentHsct + cryptoHsct;
  const totalBalanceInr = totalBalanceHsct;

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const truncateAddress = (addr: string | null) => {
    if (!addr) return '0x0000...0000';
    if (addr.length <= 16) return addr;
    return `${addr.substring(0, 8)}...${addr.substring(addr.length - 8)}`;
  };

  const handleSimulateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError(null);
    const amountHsct = Number(depositAmount);

    if (!depositAmount || isNaN(amountHsct)) {
      setDepositError('Please enter a valid numeric amount.');
      return;
    }
    if (amountHsct <= 0) {
      setDepositError('Amount must be greater than zero.');
      return;
    }
    if (amountHsct > 10000000) {
      setDepositError('Maximum deposit limit is 10,000,000 HSCT.');
      return;
    }

    setIsDepositing(true);
    try {
      await executeTransaction(
        'credit',
        amountHsct,
        'HSCT',
        `Deposited ${amountHsct.toLocaleString()} HSCT`,
        { source: 'Simulated HSCT Deposit' }
      );

      setShowDepositModal(false);
      setDepositAmount('');
    } catch (err: any) {
      console.error(err);
      setDepositError(err.message || 'Deposit failed. Please try again.');
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="min-h-screen text-white p-4 sm:p-6 md:p-10 font-sans pb-32 md:pb-12 max-w-6xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
              <Wallet className="h-6 w-6" />
            </span>
            Digital Wallet
          </h1>
          <p className="text-neutral-400 text-xs sm:text-sm mt-1">
            Non-custodial multi-asset wallet with zero gas fees and instant settlement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-pale text-neutral-950 font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-md min-h-[44px]"
          >
            <Plus size={16} /> Deposit HSCT
          </button>
          <Link
            href="/wallet/transfer"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs sm:text-sm transition-all border border-white/10 min-h-[44px]"
          >
            <ArrowUpRight size={16} /> Send
          </Link>
          <Link
            href="/wallet/receive"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs sm:text-sm transition-all border border-white/10 min-h-[44px]"
          >
            <ArrowDownLeft size={16} /> Receive
          </Link>
        </div>
      </div>

      {/* SECTION 1: WALLET BALANCE HERO CARD */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0a0a0a] border border-brand-primary/20 p-6 sm:p-8 md:p-10 shadow-2xl">
        {/* Ambient Glow */}
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-bold uppercase tracking-wider text-xs">
                Total Portfolio Value
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-primary/15 border border-brand-primary/30 text-brand-primary text-[10px] font-extrabold">
                <ShieldCheck size={11} /> SECURE
              </span>
            </div>

            <div className="flex items-baseline flex-wrap gap-2">
              <span className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white">
                {totalBalanceHsct.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xl sm:text-2xl text-brand-primary font-extrabold">HSCT</span>
            </div>

            <div className="flex items-center flex-wrap gap-3 pt-1">
              <div className="px-3 py-1 bg-[#121212] border border-white/10 rounded-full text-xs text-neutral-300 font-medium">
                Spendable Balance:{' '}
                <span className="font-extrabold text-brand-primary">
                  {currentHsct.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT
                </span>
              </div>
              <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Parity: ₹{totalBalanceInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR (1 HSCT = ₹1)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link
              href="/trade"
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs sm:text-sm border border-white/10 transition-all min-h-[44px]"
            >
              <Coins size={16} className="text-brand-primary" /> Trade Assets
            </Link>
            <button
              onClick={() => setShowDepositModal(true)}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-primary hover:bg-brand-pale text-neutral-950 font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-md min-h-[44px]"
            >
              <Plus size={16} /> Deposit
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: ASSETS LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-extrabold text-white">Your Assets</h2>
          <span className="text-xs text-neutral-400 font-medium">Supported Currencies</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              name: 'SecureChain Token',
              symbol: 'HSCT',
              balance: `${currentHsct.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              subtext: `Parity ₹${currentHsct.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`,
              badge: 'Native Utility',
              badgeColor: 'text-brand-primary bg-brand-primary/10 border-brand-primary/20',
              icon: '⚡',
            },
            {
              name: 'INR Parity Token',
              symbol: 'INR',
              balance: `₹${currentHsct.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              subtext: '1:1 HSCT Peg',
              badge: 'Fiat Parity',
              badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              icon: '₹',
            },
            {
              name: 'Ethereum',
              symbol: 'ETH',
              balance: `${ethBalance.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`,
              subtext: `≈ ${(ethBalance * ethPrice * USD_TO_HSCT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT`,
              badge: `${(ethPrice * USD_TO_HSCT).toLocaleString()} HSCT`,
              badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
              icon: 'Ξ',
            },
            {
              name: 'Bitcoin',
              symbol: 'BTC',
              balance: `${btcBalance.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`,
              subtext: `≈ ${(btcBalance * btcPrice * USD_TO_HSCT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT`,
              badge: `${(btcPrice * USD_TO_HSCT).toLocaleString()} HSCT`,
              badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
              icon: '₿',
            },
          ].map((asset) => (
            <div
              key={asset.symbol}
              className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/10 hover:border-brand-primary/30 transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#121212] border border-white/10 flex items-center justify-center text-lg font-bold">
                  {asset.icon}
                </div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${asset.badgeColor}`}>
                  {asset.badge}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-white text-sm">{asset.name}</h3>
                <p className="text-xs text-neutral-400">{asset.symbol}</p>
              </div>

              <div className="pt-2 border-t border-white/5 flex justify-between items-baseline">
                <span className="text-base font-extrabold text-white">{asset.balance}</span>
                <span className="text-[11px] text-neutral-400 font-medium">{asset.subtext}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: WALLET INFORMATION (Address, Public Key, Network) */}
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-extrabold text-white">Cryptographic Wallet Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Public Address */}
          <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-2">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
              Public Address
            </span>
            <div className="flex items-center justify-between bg-black p-3 rounded-xl border border-white/10">
              <span className="font-mono text-xs text-white truncate max-w-[180px]">
                {truncateAddress(address)}
              </span>
              <button
                onClick={() => address && handleCopy('address', address)}
                className={`p-2 rounded-lg transition-all min-h-[36px] min-w-[36px] flex items-center justify-center ${
                  copiedField === 'address'
                    ? 'bg-brand-primary text-neutral-950 font-bold'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                }`}
                title="Copy Address"
              >
                {copiedField === 'address' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">Your public destination for inbound network transactions.</p>
          </div>

          {/* Public Key */}
          <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-2">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
              Public Key
            </span>
            <div className="flex items-center justify-between bg-black p-3 rounded-xl border border-white/10">
              <span className="font-mono text-xs text-white truncate max-w-[180px]">
                {truncateAddress(publicKey || address)}
              </span>
              <button
                onClick={() => (publicKey || address) && handleCopy('publicKey', publicKey || address || '')}
                className={`p-2 rounded-lg transition-all min-h-[36px] min-w-[36px] flex items-center justify-center ${
                  copiedField === 'publicKey'
                    ? 'bg-brand-primary text-neutral-950 font-bold'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                }`}
                title="Copy Public Key"
              >
                {copiedField === 'publicKey' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">Used for cryptographic signature verification on blocks.</p>
          </div>

          {/* Network & Consensus */}
          <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-2">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
              Consensus Network
            </span>
            <div className="flex items-center justify-between bg-black p-3 rounded-xl border border-white/10">
              <span className="font-mono text-xs text-brand-primary font-bold">SecureChain PoA</span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[11px] text-neutral-500">Zero gas fees, sub-second block finality, 100% non-custodial.</p>
          </div>
        </div>
      </div>

      {/* SECTION 4: RECENT ACTIVITY */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-extrabold text-white">Recent Transactions</h2>
          <Link
            href="/transactions"
            className="text-xs font-bold text-brand-primary hover:text-brand-pale flex items-center gap-1 transition-colors min-h-[44px]"
          >
            View All Transactions <ChevronRight size={14} />
          </Link>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-4 sm:p-6 shadow-xl">
          <TransactionList transactions={transactions.slice(0, 5)} />
        </div>
      </div>

      {/* MODAL: SIMULATED DEPOSIT MODAL */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] border border-brand-primary/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Coins size={20} className="text-brand-primary" />
                <h3 className="font-extrabold text-white text-base">Deposit HSCT</h3>
              </div>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-neutral-400 hover:text-white text-lg font-bold p-1 min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Simulate an instant non-custodial deposit of HSCT into your local blockchain balance. (1 HSCT = ₹1 INR).
            </p>

            {depositError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{depositError}</span>
              </div>
            )}

            <form onSubmit={handleSimulateDeposit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Amount in HSCT
                </label>
                <div className="flex items-center bg-black border border-white/10 rounded-xl p-2.5 focus-within:border-brand-primary/50">
                  <span className="px-3 text-lg font-bold text-brand-primary">⚡</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="e.g. 5000"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="bg-transparent border-none text-xl font-bold text-white focus:outline-none flex-1 placeholder:text-neutral-600"
                    autoFocus
                  />
                  <span className="text-xs font-bold text-neutral-400 pr-2">HSCT</span>
                </div>
              </div>

              {/* Preset Chips */}
              <div className="flex items-center gap-2">
                {['500', '1000', '5000', '10000'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDepositAmount(val)}
                    className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-neutral-300 transition-colors min-h-[36px]"
                  >
                    +{val}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDepositing || !depositAmount}
                  className="flex-1 py-3 bg-brand-primary hover:bg-brand-pale disabled:opacity-50 text-neutral-950 font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {isDepositing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                      Depositing...
                    </>
                  ) : (
                    'Confirm Deposit'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
