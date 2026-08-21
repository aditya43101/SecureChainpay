'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useWalletStore, type Transaction } from '@/stores/wallet-store';
import { useRouter } from 'next/navigation';
import {
  Search,
  UserCheck,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wallet,
  ArrowLeft,
  Lock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecipientUser {
  uid: string;
  username: string;
  displayName: string;
  walletAddress: string;
  avatarUrl?: string | null;
  email?: string | null;
}

const PRESET_AMOUNTS = [25, 50, 100, 250, 500];

export default function TransferPage() {
  const { transferFunds, balances, transactions, address: currentWalletAddress, ownerUid } = useWalletStore();
  const router = useRouter();

  // Multi-step Flow: 'search' -> 'amount' -> 'confirm' -> 'processing' -> 'success'
  const [step, setStep] = useState<'select_recipient' | 'enter_amount' | 'confirm_payment' | 'success'>('select_recipient');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RecipientUser[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected Recipient
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientUser | null>(null);

  // Transfer Details
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);

  const availableBalance = Number(balances.USD || 0);
  const numericAmount = Number(amount || 0);

  // ─── RECENT RECIPIENTS (from real transaction history) ───
  const recentRecipients = useMemo(() => {
    const recipientsMap = new Map<string, { address: string; name: string }>();
    transactions.forEach((tx) => {
      if (
        tx.receiver &&
        tx.receiver !== 'System' &&
        tx.receiver !== '0x0000000000000000000000000000000000000000' &&
        tx.receiver.toLowerCase() !== currentWalletAddress?.toLowerCase()
      ) {
        const desc = tx.description || '';
        const name = desc.startsWith('Transfer to ')
          ? desc.replace('Transfer to ', '')
          : desc.startsWith('Sent $')
          ? desc.split(' to ')[1] || tx.receiver.substring(0, 8)
          : tx.payload?.receiverDisplayName || tx.payload?.receiverUsername || tx.receiver.substring(0, 8);

        if (!recipientsMap.has(tx.receiver.toLowerCase())) {
          recipientsMap.set(tx.receiver.toLowerCase(), {
            address: tx.receiver,
            name,
          });
        }
      }
    });
    return Array.from(recipientsMap.values()).slice(0, 4);
  }, [transactions, currentWalletAddress]);

  // ─── DEBOUNCED SEARCH ───
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const cleanQ = searchQuery.trim();
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(cleanQ)}&currentUid=${ownerUid || ''}`);
        const data = await res.json();

        if (data.success) {
          setSearchResults(data.results || []);
          if (data.results?.length === 0) {
            setSearchError('No registered users found matching your query.');
          }
        } else {
          setSearchError(data.error || 'Search query failed');
        }
      } catch (err: any) {
        console.warn('Search error:', err);
        setSearchError('Search service currently unavailable');
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, ownerUid]);

  // ─── HANDLE SELECT RECIPIENT ───
  const handleSelectRecipient = (recipient: RecipientUser) => {
    // Validate self-transfer
    if (
      recipient.uid === ownerUid ||
      recipient.walletAddress.toLowerCase() === currentWalletAddress?.toLowerCase()
    ) {
      setSearchError('You cannot send money to your own wallet.');
      return;
    }

    setSelectedRecipient(recipient);
    setTransferError(null);
    setStep('enter_amount');
  };

  // ─── HANDLE PROCEED TO CONFIRMATION ───
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);

    if (!selectedRecipient) {
      setTransferError('Please select a valid recipient.');
      return;
    }

    if (!numericAmount || numericAmount <= 0) {
      setTransferError('Please enter an amount greater than 0.');
      return;
    }

    if (numericAmount > availableBalance) {
      setTransferError(`Insufficient balance. You have $${availableBalance.toFixed(2)} USD.`);
      return;
    }

    setStep('confirm_payment');
  };

  // ─── HANDLE CONFIRM & SEND (REAL TRANSACTION EXECUTION) ───
  const handleConfirmAndSend = async () => {
    if (!selectedRecipient || numericAmount <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    setTransferError(null);

    try {
      const resultTx = await transferFunds({
        receiverUid: selectedRecipient.uid,
        receiverAddress: selectedRecipient.walletAddress,
        receiverUsername: selectedRecipient.username,
        receiverDisplayName: selectedRecipient.displayName,
        amount: numericAmount,
        currency: 'USD',
        note: note.trim() || undefined,
      });

      setCompletedTx(resultTx);
      setStep('success');
    } catch (err: any) {
      console.error('Transfer execution error:', err);
      setTransferError(err?.message || 'Transfer failed. Please check network and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatShortAddress = (addr: string) => {
    if (!addr || addr.length < 10) return addr;
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white p-6 md:p-12 font-sans flex flex-col items-center justify-center relative">
      <div className="w-full max-w-xl">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/wallet"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft size={18} />
            Back to Wallet
          </Link>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-neutral-500 font-mono">SecureChain PoA Ledger</span>
          </div>
        </div>

        <div className="bg-neutral-950/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
          {/* Ambient Lighting */}
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* ═══════════════════════════════════════════════════════ */}
          {/* STEP 1: RECIPIENT SEARCH & SELECTION */}
          {/* ═══════════════════════════════════════════════════════ */}
          {step === 'select_recipient' && (
            <div className="relative z-10 space-y-6 animate-in fade-in duration-300">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-semibold border border-indigo-500/20 mb-3">
                  <Sparkles size={13} /> Step 1 of 3: Recipient
                </div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Send Money</h1>
                <p className="text-neutral-400 text-sm mt-1">
                  Search registered SecureChain Pay users by username or wallet address.
                </p>
              </div>

              {/* Search Box */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Search Recipient
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter @username, Name, or 0x wallet address..."
                    className="w-full bg-neutral-900 border border-white/10 text-white py-4 pl-12 pr-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600 text-sm"
                    autoFocus
                  />
                  {isSearching && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Search Error / Empty Notice */}
              {searchError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Search Results List */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Search Results</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {searchResults.map((user) => (
                      <div
                        key={user.uid}
                        onClick={() => handleSelectRecipient(user)}
                        className="flex items-center justify-between p-3.5 bg-neutral-900/80 hover:bg-indigo-950/30 border border-white/10 hover:border-indigo-500/40 rounded-2xl cursor-pointer transition-all group shadow-sm"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-md flex-shrink-0">
                            {user.displayName?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-sm truncate">{user.displayName}</span>
                              <UserCheck size={14} className="text-emerald-400 flex-shrink-0" />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                              <span>@{user.username}</span>
                              <span>•</span>
                              <span className="text-neutral-500">{formatShortAddress(user.walletAddress)}</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          className="bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 text-xs font-semibold rounded-xl"
                        >
                          Select <ArrowRight size={14} className="ml-1" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Real Recipients */}
              {recentRecipients.length > 0 && searchResults.length === 0 && !searchQuery && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
                    <Clock size={13} /> Recent Recipients
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {recentRecipients.map((rec, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSearchQuery(rec.address);
                        }}
                        className="p-3 bg-neutral-900/50 hover:bg-neutral-900 border border-white/5 hover:border-white/20 rounded-xl cursor-pointer transition-all"
                      >
                        <p className="font-semibold text-white text-xs truncate">{rec.name}</p>
                        <p className="text-[11px] font-mono text-neutral-500 truncate mt-0.5">{formatShortAddress(rec.address)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-neutral-900/30 border border-white/5 flex items-center justify-between text-xs text-neutral-400">
                <span className="flex items-center gap-1.5"><Wallet size={14} className="text-indigo-400" /> Available Balance:</span>
                <span className="font-bold text-white text-sm">${availableBalance.toFixed(2)} USD</span>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════ */}
          {/* STEP 2: ENTER AMOUNT & ASSET */}
          {/* ═══════════════════════════════════════════════════════ */}
          {step === 'enter_amount' && selectedRecipient && (
            <form onSubmit={handleProceedToConfirm} className="relative z-10 space-y-6 animate-in fade-in duration-300">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-semibold border border-indigo-500/20 mb-3">
                  <Sparkles size={13} /> Step 2 of 3: Amount
                </div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Enter Amount</h1>
                <p className="text-neutral-400 text-sm mt-1">Specify how much USD you want to transfer.</p>
              </div>

              {/* Verified Recipient Banner */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-950/40 to-neutral-900 border border-indigo-500/30 rounded-2xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {selectedRecipient.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Sending To</p>
                    <p className="font-bold text-white text-sm truncate">{selectedRecipient.displayName} (@{selectedRecipient.username})</p>
                    <p className="text-xs font-mono text-neutral-400 truncate">{formatShortAddress(selectedRecipient.walletAddress)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('select_recipient');
                    setSelectedRecipient(null);
                  }}
                  className="text-xs text-neutral-400 hover:text-white underline underline-offset-4"
                >
                  Change
                </button>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Transfer Amount (USD)
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmount(availableBalance.toString())}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
                  >
                    Use Max (${availableBalance.toFixed(2)})
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl text-neutral-500 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={availableBalance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-neutral-900 border border-white/10 text-white text-4xl font-black py-6 pl-14 pr-6 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-center placeholder:text-neutral-700"
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Preset Chips */}
              <div className="grid grid-cols-5 gap-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setAmount(preset.toString())}
                    className={`py-2.5 rounded-xl font-semibold text-xs border transition-all ${
                      amount === preset.toString()
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                        : 'bg-neutral-900 border-white/5 text-neutral-400 hover:bg-neutral-800 hover:text-white'
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>

              {/* Note Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Note / Reason (Optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Invoice payment, Dinner bill..."
                  className="w-full bg-neutral-900 border border-white/10 text-white py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm placeholder:text-neutral-600"
                />
              </div>

              {/* Error Box */}
              {transferError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{transferError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('select_recipient')}
                  className="w-1/3 py-6 bg-transparent border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 rounded-2xl font-bold"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={!numericAmount || numericAmount <= 0 || numericAmount > availableBalance}
                  className="w-2/3 py-6 bg-white text-black hover:bg-neutral-200 rounded-2xl font-bold text-base shadow-[0_0_20px_rgba(255,255,255,0.15)] disabled:opacity-50"
                >
                  Review Transfer <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            </form>
          )}

          {/* ═══════════════════════════════════════════════════════ */}
          {/* STEP 3: DEDICATED CONFIRMATION SCREEN (REQUIRED) */}
          {/* ═══════════════════════════════════════════════════════ */}
          {step === 'confirm_payment' && selectedRecipient && (
            <div className="relative z-10 space-y-6 animate-in fade-in duration-300">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-semibold border border-amber-500/20 mb-3">
                  <Lock size={13} /> Final Step: Review & Authorize
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight">CONFIRM PAYMENT</h1>
                <p className="text-neutral-400 text-sm mt-1">
                  Please review the recipient and payment details before signing.
                </p>
              </div>

              {/* Recipient Details Highlight Box */}
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 space-y-4 shadow-inner">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Recipient</span>
                  <div className="text-right">
                    <p className="font-extrabold text-white text-base">{selectedRecipient.displayName}</p>
                    <p className="text-xs text-indigo-400 font-mono">@{selectedRecipient.username}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Wallet Address</span>
                  <p className="font-mono text-xs text-neutral-300 break-all max-w-[240px] text-right">
                    {selectedRecipient.walletAddress}
                  </p>
                </div>

                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Amount to Send</span>
                  <p className="font-black text-2xl text-emerald-400">${numericAmount.toFixed(2)} USD</p>
                </div>

                <div className="flex items-center justify-between border-b border-white/5 pb-3 text-xs">
                  <span className="font-medium text-neutral-400">Estimated Network Fee</span>
                  <span className="text-emerald-400 font-bold">$0.00 (Free / PoA)</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-neutral-400">Total Debit from Wallet</span>
                  <span className="text-white font-extrabold text-sm">${numericAmount.toFixed(2)} USD</span>
                </div>
              </div>

              {note && (
                <div className="p-3 bg-neutral-900/50 rounded-xl border border-white/5 text-xs text-neutral-400">
                  <span className="font-semibold text-neutral-300">Note:</span> {note}
                </div>
              )}

              {/* Security & Cryptographic Notice */}
              <div className="p-3.5 bg-indigo-950/30 border border-indigo-500/20 rounded-xl flex items-start gap-3 text-xs text-indigo-200">
                <ShieldCheck className="text-indigo-400 flex-shrink-0 mt-0.5" size={18} />
                <p>
                  This transfer will be cryptographically signed with your private key and anchored into the SecureChain Pay global shared blockchain.
                </p>
              </div>

              {transferError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{transferError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => setStep('enter_amount')}
                  className="w-1/3 py-6 bg-transparent border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 rounded-2xl font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmAndSend}
                  className="w-2/3 py-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-base rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.3)] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                      Authorizing & Sending...
                    </>
                  ) : (
                    <>
                      CONFIRM & SEND ${numericAmount.toFixed(2)}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════ */}
          {/* STEP 4: PAYMENT SUCCESS STATE */}
          {/* ═══════════════════════════════════════════════════════ */}
          {step === 'success' && selectedRecipient && (
            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-6 py-6 animate-in zoom-in-95 duration-400">
              <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/40">
                <CheckCircle2 size={44} />
              </div>

              <div>
                <h2 className="text-3xl font-black text-white tracking-tight mb-1">PAYMENT SUCCESSFUL ✓</h2>
                <p className="text-neutral-400 text-sm">
                  Successfully transferred <span className="text-emerald-400 font-bold">${numericAmount.toFixed(2)} USD</span> to {selectedRecipient.displayName}
                </p>
              </div>

              {/* Transaction Receipt Card */}
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 w-full text-left space-y-3 font-mono text-xs">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-neutral-400 font-sans">Recipient</span>
                  <span className="text-white font-bold">{selectedRecipient.displayName} (@{selectedRecipient.username})</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-neutral-400 font-sans">Recipient Wallet</span>
                  <span className="text-indigo-300">{formatShortAddress(selectedRecipient.walletAddress)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-neutral-400 font-sans">Transaction ID</span>
                  <span className="text-neutral-300">{completedTx?.id || 'TX_CONFIRMED'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-neutral-400 font-sans">Global Block</span>
                  <span className="text-emerald-400 font-bold">#{completedTx?.blockNumber ?? 1}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-neutral-400 font-sans">Blockchain Status</span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[11px] font-bold">
                    CONFIRMED ✓
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full pt-2">
                <Button
                  onClick={() => router.push('/explorer')}
                  className="py-6 bg-white text-black hover:bg-neutral-200 font-bold rounded-2xl text-sm shadow-md"
                >
                  View in Explorer <ExternalLink size={16} className="ml-1.5" />
                </Button>
                <Button
                  onClick={() => {
                    setSelectedRecipient(null);
                    setAmount('');
                    setNote('');
                    setSearchQuery('');
                    setStep('select_recipient');
                  }}
                  variant="outline"
                  className="py-6 bg-transparent border-white/10 text-white hover:bg-white/5 font-bold rounded-2xl text-sm"
                >
                  Send Another
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
