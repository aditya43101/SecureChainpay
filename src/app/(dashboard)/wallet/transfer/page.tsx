'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useWalletStore, type Transaction, USD_TO_HSCT } from '@/stores/wallet-store';
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
  QrCode,
  Users,
  Link as LinkIcon,
  Send,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRScannerModal } from '@/components/wallet/QRScannerModal';
import { ResolvedRecipient, abbreviateAddress, resolveRecipientFromPayload, resolveRecipientFromQR } from '@/lib/payments/recipient-resolver';
import type { PaymentRiskAssessment } from '@/lib/payments/payment-risk-engine';

interface RecipientUser {
  uid: string;
  username: string;
  displayName: string;
  walletAddress: string;
  avatarUrl?: string | null;
  email?: string | null;
}

const PRESET_AMOUNTS = [100, 500, 1000, 5000];

export default function TransferPage() {
  const { transferFunds, balances, transactions, address: currentWalletAddress, ownerUid } = useWalletStore();
  const router = useRouter();

  // Multi-step Flow: 'select_recipient' -> 'enter_amount' -> 'confirm_payment' -> 'success'
  const [step, setStep] = useState<'select_recipient' | 'enter_amount' | 'confirm_payment' | 'success'>('select_recipient');

  // Recipient Input Channel Tab: 'search' | 'qr' | 'address' | 'recent'
  const [recipientTab, setRecipientTab] = useState<'search' | 'qr' | 'address' | 'recent'>('search');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // Manual Address State
  const [manualAddress, setManualAddress] = useState('');
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RecipientUser[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected Recipient (Internal User or External Wallet)
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientUser | null>(null);

  // Transfer Details
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);

  const availableBalanceHsct = Number(balances.USD || 0) * USD_TO_HSCT;
  const numericAmount = Number(amount || 0);

  // ─── RECENT RECIPIENTS (from real transaction history) ───
  const recentRecipients = useMemo(() => {
    const recipientsMap = new Map<string, { address: string; name: string; username?: string }>();
    transactions.forEach((tx) => {
      if (
        tx.receiver &&
        tx.receiver !== 'System' &&
        tx.receiver !== '0x0000000000000000000000000000000000000000' &&
        tx.receiver.toLowerCase() !== currentWalletAddress?.toLowerCase()
      ) {
        const desc = tx.description || '';
        let name = abbreviateAddress(tx.receiver);
        let username = '';

        if (tx.payload?.receiverDisplayName) {
          name = tx.payload.receiverDisplayName;
          username = tx.payload.receiverUsername || '';
        } else if (desc.startsWith('Transfer to ')) {
          name = desc.replace('Transfer to ', '');
        } else if (desc.startsWith('Sent ')) {
          name = desc.split(' to ')[1] || abbreviateAddress(tx.receiver);
        }

        if (!recipientsMap.has(tx.receiver.toLowerCase())) {
          recipientsMap.set(tx.receiver.toLowerCase(), {
            address: tx.receiver,
            name,
            username,
          });
        }
      }
    });
    return Array.from(recipientsMap.values()).slice(0, 6);
  }, [transactions, currentWalletAddress]);

  // ─── DEBOUNCED USER SEARCH ───
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
      (recipient.uid && recipient.uid === ownerUid) ||
      recipient.walletAddress.toLowerCase() === currentWalletAddress?.toLowerCase()
    ) {
      setSearchError('You cannot send HSCT to your own wallet.');
      return;
    }

    setSelectedRecipient(recipient);
    setTransferError(null);
    setStep('enter_amount');
  };

  // ─── HANDLE QR SCAN SUCCESS ───
  const handleQRSuccess = (resolved: ResolvedRecipient) => {
    if (resolved.walletAddress.toLowerCase() === currentWalletAddress?.toLowerCase()) {
      setTransferError('Scanned QR code belongs to your own wallet.');
      return;
    }

    setSelectedRecipient({
      uid: resolved.uid || '',
      username: resolved.username || 'external',
      displayName: resolved.displayName || abbreviateAddress(resolved.walletAddress),
      walletAddress: resolved.walletAddress,
    });
    setTransferError(null);
    setStep('enter_amount');
  };

  // ─── HANDLE MANUAL ADDRESS RESOLVE ───
  const handleResolveManualAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    const cleanAddr = manualAddress.trim();

    if (!cleanAddr || !cleanAddr.startsWith('0x') || cleanAddr.length < 10) {
      setSearchError('Please enter a valid 0x wallet address.');
      return;
    }

    if (cleanAddr.toLowerCase() === currentWalletAddress?.toLowerCase()) {
      setSearchError('You cannot send HSCT to your own wallet.');
      return;
    }

    setIsResolvingAddress(true);
    try {
      // Try resolving server-side first to see if this address belongs to a registered SecureChain user
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(cleanAddr)}&currentUid=${ownerUid || ''}`);
      const data = await res.json();

      if (data.success && data.results && data.results.length > 0) {
        const found = data.results[0];
        handleSelectRecipient(found);
      } else {
        // Treat as external wallet
        handleSelectRecipient({
          uid: '',
          username: 'external',
          displayName: `External Wallet (${abbreviateAddress(cleanAddr)})`,
          walletAddress: cleanAddr,
        });
      }
    } catch (err) {
      // Fallback to external wallet
      handleSelectRecipient({
        uid: '',
        username: 'external',
        displayName: `External Wallet (${abbreviateAddress(cleanAddr)})`,
        walletAddress: cleanAddr,
      });
    } finally {
      setIsResolvingAddress(false);
    }
  };

  // Risk Assessment State
  const [riskAssessment, setRiskAssessment] = useState<PaymentRiskAssessment | null>(null);
  const [isEvaluatingRisk, setIsEvaluatingRisk] = useState(false);

  // ─── HANDLE PROCEED TO CONFIRMATION (WITH PAYMENT AI PRE-FLIGHT EVALUATION) ───
  const handleProceedToConfirm = async (e: React.FormEvent) => {
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

    if (numericAmount > availableBalanceHsct) {
      setTransferError(`Insufficient balance. You have ${availableBalanceHsct.toLocaleString()} HSCT.`);
      return;
    }

    setIsEvaluatingRisk(true);
    try {
      const res = await fetch('/api/payments/risk-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: ownerUid || 'demo_user',
          senderAddress: currentWalletAddress || '',
          receiverAddress: selectedRecipient.walletAddress,
          receiverDisplayName: selectedRecipient.displayName,
          amount: numericAmount,
          currency: 'HSCT',
        }),
      });

      const data = await res.json();
      if (data.success && data.assessment) {
        setRiskAssessment(data.assessment);
      }
    } catch (riskErr) {
      console.warn('[TransferPage] Risk evaluation fallback notice:', riskErr);
    } finally {
      setIsEvaluatingRisk(false);
      setStep('confirm_payment');
    }
  };

  // ─── HANDLE CONFIRM & SEND (REAL TRANSACTION EXECUTION) ───
  const handleConfirmAndSend = async () => {
    if (!selectedRecipient || numericAmount <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    setTransferError(null);

    try {
      const amountUsd = numericAmount / USD_TO_HSCT;
      const resultTx = await transferFunds({
        receiverUid: selectedRecipient.uid || undefined,
        receiverAddress: selectedRecipient.walletAddress,
        receiverUsername: selectedRecipient.username !== 'external' ? selectedRecipient.username : undefined,
        receiverDisplayName: selectedRecipient.displayName,
        amount: amountUsd,
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

          {/* STEP 1: RECIPIENT SELECTION & CHANNELS */}
          {step === 'select_recipient' && (
            <div className="relative z-10 space-y-6 animate-in fade-in duration-300">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-semibold border border-indigo-500/20 mb-3">
                  <Sparkles size={13} /> Step 1 of 3: Recipient Selection
                </div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Send Money</h1>
                <p className="text-neutral-400 text-sm mt-1">
                  Choose a recipient using registered user search, camera QR scan, wallet address, or recent contacts.
                </p>
              </div>

              {/* 4 Selection Tabs */}
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-neutral-900 border border-white/10 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setRecipientTab('search')}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                    recipientTab === 'search'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Search size={15} />
                  <span>Search</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRecipientTab('qr');
                    setIsQRModalOpen(true);
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                    recipientTab === 'qr'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <QrCode size={15} />
                  <span>Scan QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRecipientTab('address')}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                    recipientTab === 'address'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <LinkIcon size={15} />
                  <span>Address</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRecipientTab('recent')}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                    recipientTab === 'recent'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Users size={15} />
                  <span>Recent</span>
                </button>
              </div>

              {/* TAB 1: SEARCH USER */}
              {recipientTab === 'search' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Search Registered User
                    </label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Enter @username, Name, or email..."
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

                  {/* Search Error */}
                  {searchError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                      <AlertCircle size={16} className="flex-shrink-0" />
                      <span>{searchError}</span>
                    </div>
                  )}

                  {/* Search Results List */}
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Registered Users</p>
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
                                  <span className="text-neutral-500">{abbreviateAddress(user.walletAddress)}</span>
                                </div>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              className="bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 text-xs font-semibold rounded-xl"
                            >
                              Pay <ArrowRight size={14} className="ml-1" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SCAN QR */}
              {recipientTab === 'qr' && (
                <div className="text-center space-y-4 py-4">
                  <div className="p-6 rounded-2xl bg-neutral-900 border border-white/10 flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg">
                      <QrCode size={36} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">Scan SecureChain Pay QR Code</h3>
                      <p className="text-neutral-400 text-xs mt-1 max-w-xs mx-auto">
                        Use live camera video feed or upload a QR image file to instantly resolve recipient details.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setIsQRModalOpen(true)}
                      className="py-6 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl text-sm shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                    >
                      <QrCode size={18} className="mr-2" /> Launch Camera Scanner
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 3: ENTER WALLET ADDRESS */}
              {recipientTab === 'address' && (
                <form onSubmit={handleResolveManualAddress} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Enter Blockchain Wallet Address
                    </label>
                    <input
                      type="text"
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder="0x82F3...91A7"
                      className="w-full bg-neutral-900 border border-white/10 text-white py-4 px-4 font-mono text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600"
                    />
                  </div>

                  {searchError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                      <AlertCircle size={16} className="flex-shrink-0" />
                      <span>{searchError}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={!manualAddress || isResolvingAddress}
                    className="w-full py-6 bg-white text-black hover:bg-neutral-200 rounded-2xl font-bold text-sm disabled:opacity-50"
                  >
                    {isResolvingAddress ? 'Resolving Address...' : 'Resolve Recipient'}
                  </Button>
                </form>
              )}

              {/* TAB 4: RECENT RECIPIENTS */}
              {recipientTab === 'recent' && (
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Recent Payment Contacts</p>
                  {recentRecipients.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {recentRecipients.map((rec, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            handleSelectRecipient({
                              uid: '',
                              username: rec.username || 'external',
                              displayName: rec.name,
                              walletAddress: rec.address,
                            });
                          }}
                          className="p-3.5 bg-neutral-900/80 hover:bg-neutral-900 border border-white/10 hover:border-indigo-500/40 rounded-2xl cursor-pointer transition-all flex items-center gap-3"
                        >
                          <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-indigo-400 font-bold text-sm flex-shrink-0 border border-white/5">
                            {rec.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white text-xs truncate">{rec.name}</p>
                            <p className="text-[11px] font-mono text-neutral-500 truncate mt-0.5">{abbreviateAddress(rec.address)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-900/50 rounded-2xl border border-white/5">
                      No recent transaction recipients found.
                    </div>
                  )}
                </div>
              )}

              {/* Available Balance Box */}
              <div className="p-4 rounded-2xl bg-neutral-900/40 border border-white/5 flex items-center justify-between text-xs text-neutral-400">
                <span className="flex items-center gap-1.5"><Wallet size={14} className="text-indigo-400" /> Available Balance:</span>
                <span className="font-bold text-white text-sm">{availableBalanceHsct.toLocaleString()} HSCT</span>
              </div>
            </div>
          )}

          {/* STEP 2: ENTER AMOUNT */}
          {step === 'enter_amount' && selectedRecipient && (
            <form onSubmit={handleProceedToConfirm} className="relative z-10 space-y-6 animate-in fade-in duration-300">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-semibold border border-indigo-500/20 mb-3">
                  <Sparkles size={13} /> Step 2 of 3: Transfer Amount
                </div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Enter Amount</h1>
                <p className="text-neutral-400 text-sm mt-1">Specify how much HSCT you want to transfer.</p>
              </div>

              {/* Verified Recipient Profile Card */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-950/40 to-neutral-900 border border-indigo-500/30 rounded-2xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {selectedRecipient.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Sending To</p>
                    <p className="font-bold text-white text-sm truncate">
                      {selectedRecipient.displayName} {selectedRecipient.username && selectedRecipient.username !== 'external' ? `(@${selectedRecipient.username})` : ''}
                    </p>
                    <p className="text-xs font-mono text-neutral-400 truncate">{abbreviateAddress(selectedRecipient.walletAddress)}</p>
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
                    Transfer Amount (HSCT)
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmount(availableBalanceHsct.toString())}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
                  >
                    Use Max ({availableBalanceHsct.toLocaleString()} HSCT)
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={availableBalanceHsct}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-neutral-900 border border-white/10 text-white text-4xl font-black py-6 px-6 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-center placeholder:text-neutral-700"
                    autoFocus
                    required
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg text-neutral-500 font-bold font-mono">HSCT</span>
                </div>
              </div>

              {/* Preset Chips */}
              <div className="grid grid-cols-4 gap-2">
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
                    {preset}
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
                  placeholder="e.g. Dinner split, In-game buy-in..."
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
                  disabled={!numericAmount || numericAmount <= 0 || numericAmount > availableBalanceHsct}
                  className="w-2/3 py-6 bg-white text-black hover:bg-neutral-200 rounded-2xl font-bold text-base shadow-[0_0_20px_rgba(255,255,255,0.15)] disabled:opacity-50"
                >
                  Review Transfer <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 3: CONFIRMATION SCREEN */}
          {step === 'confirm_payment' && selectedRecipient && (
            <div className="relative z-10 space-y-6 animate-in fade-in duration-300">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-semibold border border-amber-500/20 mb-3">
                  <Lock size={13} /> Final Step: Review & Authorize
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight">CONFIRM PAYMENT</h1>
                <p className="text-neutral-400 text-sm mt-1">
                  Please review recipient and transaction parameters before signing.
                </p>
              </div>

              {/* Recipient Details Highlight Box */}
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 space-y-4 shadow-inner">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Recipient</span>
                  <div className="text-right">
                    <p className="font-extrabold text-white text-base">{selectedRecipient.displayName}</p>
                    {selectedRecipient.username && selectedRecipient.username !== 'external' && (
                      <p className="text-xs text-indigo-400 font-mono">@{selectedRecipient.username}</p>
                    )}
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
                  <p className="font-black text-2xl text-emerald-400">{numericAmount.toLocaleString()} HSCT</p>
                </div>

                <div className="flex items-center justify-between border-b border-white/5 pb-3 text-xs">
                  <span className="font-medium text-neutral-400">Estimated Network Fee</span>
                  <span className="text-emerald-400 font-bold">0.00 (Free / PoA)</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-neutral-400">Total Debit from Wallet</span>
                  <span className="text-white font-extrabold text-sm">{numericAmount.toLocaleString()} HSCT</span>
                </div>
              </div>

              {note && (
                <div className="p-3 bg-neutral-900/50 rounded-xl border border-white/5 text-xs text-neutral-400">
                  <span className="font-semibold text-neutral-300">Note:</span> {note}
                </div>
              )}

              {/* Security Notice */}
              <div className="p-3.5 bg-indigo-950/30 border border-indigo-500/20 rounded-xl flex items-start gap-3 text-xs text-indigo-200">
                <ShieldCheck className="text-indigo-400 flex-shrink-0 mt-0.5" size={18} />
                <p>
                  This transfer will be cryptographically signed and anchored into the SecureChain Pay global shared blockchain.
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
                      CONFIRM & SEND {numericAmount.toLocaleString()} HSCT
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS STATE */}
          {step === 'success' && selectedRecipient && (
            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-6 py-6 animate-in zoom-in-95 duration-400">
              <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/40">
                <CheckCircle2 size={44} />
              </div>

              <div>
                <h2 className="text-3xl font-black text-white tracking-tight mb-1">PAYMENT SUCCESSFUL ✓</h2>
                <p className="text-neutral-400 text-sm">
                  Successfully transferred <span className="text-emerald-400 font-bold">{numericAmount.toLocaleString()} HSCT</span> to {selectedRecipient.displayName}
                </p>
              </div>

              {/* Transaction Receipt Card */}
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 w-full text-left space-y-3 font-mono text-xs">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-neutral-400 font-sans">Recipient</span>
                  <span className="text-white font-bold">{selectedRecipient.displayName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-neutral-400 font-sans">Recipient Wallet</span>
                  <span className="text-indigo-300">{abbreviateAddress(selectedRecipient.walletAddress)}</span>
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
                    setManualAddress('');
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

      {/* QR Scanner Camera Modal */}
      <QRScannerModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        onScanSuccess={handleQRSuccess}
      />
    </div>
  );
}
