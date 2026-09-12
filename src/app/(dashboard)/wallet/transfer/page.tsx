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
  Star,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRScannerModal } from '@/components/wallet/QRScannerModal';
import { VerificationPopup, PaymentVerificationDetails } from '@/components/wallet/VerificationPopup';
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

export interface FriendItem {
  id: string;
  uid: string;
  friendUid: string;
  username: string;
  displayName: string;
  walletAddress: string;
  avatarUrl?: string | null;
  priority: number;
}

const PRESET_AMOUNTS = [100, 500, 1000, 5000];

export default function TransferPage() {
  const { transferFunds, balances, transactions, address: currentWalletAddress, ownerUid } = useWalletStore();
  const router = useRouter();

  // Multi-step Flow: 'select_recipient' -> 'enter_amount' -> 'confirm_payment' -> 'success'
  const [step, setStep] = useState<'select_recipient' | 'enter_amount' | 'confirm_payment' | 'success'>('select_recipient');

  // Friends State (Priority #1)
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  // Recipient Input Channel Tab: 'search' | 'qr' | 'address' | 'recent'
  const [recipientTab, setRecipientTab] = useState<'search' | 'qr' | 'address' | 'recent'>('search');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

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

  // ─── FETCH USER'S FRIENDS (PRIORITY #1) ───
  useEffect(() => {
    async function loadFriends() {
      setIsLoadingFriends(true);
      try {
        const res = await fetch(`/api/friends?uid=${ownerUid || ''}`);
        const data = await safeParseJson(res);
        if (data && data.success && Array.isArray(data.friends)) {
          setFriends(data.friends);
        }
      } catch (err) {
        console.warn('Could not load friends for transfer page:', err);
      } finally {
        setIsLoadingFriends(false);
      }
    }
    loadFriends();
  }, [ownerUid]);

  // ─── AUTO-SELECT RECIPIENT FROM URL SEARCH PARAMS (?to= / ?username= / ?name=) ───
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const toAddress = params.get('to');
    const toUsername = params.get('username');
    const toName = params.get('name');
    const toAmount = params.get('amount');

    if (toAddress) {
      // Check if matches a friend first (Priority #1)
      const matchedFriend = friends.find(
        (f) =>
          f.walletAddress.toLowerCase() === toAddress.toLowerCase() ||
          (toUsername && f.username.toLowerCase() === toUsername.toLowerCase())
      );

      if (matchedFriend) {
        setSelectedRecipient({
          uid: matchedFriend.friendUid || matchedFriend.uid,
          username: matchedFriend.username,
          displayName: matchedFriend.displayName,
          walletAddress: matchedFriend.walletAddress,
          avatarUrl: matchedFriend.avatarUrl,
        });
      } else {
        setSelectedRecipient({
          uid: '',
          username: toUsername || 'external',
          displayName: toName || (toUsername ? `@${toUsername}` : abbreviateAddress(toAddress)),
          walletAddress: toAddress,
        });
      }

      if (toAmount && Number(toAmount) > 0) {
        setAmount(toAmount);
      }

      setStep('enter_amount');
    }
  }, [friends]);

  const availableBalanceHsct = Number(
    (balances.HSCT && balances.HSCT > 0)
      ? balances.HSCT
      : ((balances.USD && balances.USD > 0) ? balances.USD * USD_TO_HSCT : 0)
  );
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

async function safeParseJson(res: Response): Promise<any> {
  try {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.warn(`[safeParseJson] Endpoint returned non-JSON (${res.status})`);
      return { success: false, error: res.ok ? 'Invalid JSON response' : `Server error (${res.status})` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Request failed' };
  }
}

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
        const data = await safeParseJson(res);

        if (data && data.success) {
          const raw = (data.results || []) as RecipientUser[];
          const sorted = [...raw].sort((a, b) => {
            const aIsFriend = friends.some(
              (f) =>
                f.walletAddress.toLowerCase() === a.walletAddress.toLowerCase() ||
                f.username.toLowerCase() === a.username.toLowerCase()
            );
            const bIsFriend = friends.some(
              (f) =>
                f.walletAddress.toLowerCase() === b.walletAddress.toLowerCase() ||
                f.username.toLowerCase() === b.username.toLowerCase()
            );
            if (aIsFriend && !bIsFriend) return -1;
            if (!aIsFriend && bIsFriend) return 1;
            return 0;
          });
          setSearchResults(sorted);
          if (sorted.length === 0) {
            setSearchError('No registered users found matching your query.');
          }
        } else {
          setSearchError(data?.error || 'Search query failed');
        }
      } catch (err: any) {
        setSearchError(err.message || 'Error fetching user directory');
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, ownerUid]);

  // ─── HANDLE SELECT RECIPIENT ───
  const handleSelectRecipient = (recipient: RecipientUser) => {
    setSelectedRecipient(recipient);
    setTransferError(null);
    setSearchError(null);
    setStep('enter_amount');
  };

  // ─── HANDLE QR SCAN SUCCESS ───
  const handleQRSuccess = (resolved: ResolvedRecipient) => {
    const isSelf = resolved.walletAddress.toLowerCase() === currentWalletAddress?.toLowerCase();

    setSelectedRecipient({
      uid: resolved.uid || '',
      username: resolved.username || (isSelf ? 'my_wallet' : 'external'),
      displayName: resolved.displayName || (isSelf ? 'My Wallet (Self)' : abbreviateAddress(resolved.walletAddress)),
      walletAddress: resolved.walletAddress,
    });
    if (resolved.amount && resolved.amount > 0) {
      setAmount(resolved.amount.toString());
    }
    setTransferError(null);
    setSearchError(null);
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

    setIsResolvingAddress(true);
    try {
      // Try resolving server-side first to see if this address belongs to a registered SecureChain user
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(cleanAddr)}&currentUid=${ownerUid || ''}`);
      const data = await safeParseJson(res);

      if (data && data.success && data.results && data.results.length > 0) {
        const found = data.results[0];
        handleSelectRecipient(found);
      } else {
        const isSelf = cleanAddr.toLowerCase() === currentWalletAddress?.toLowerCase();
        handleSelectRecipient({
          uid: '',
          username: isSelf ? 'my_wallet' : 'external',
          displayName: isSelf ? 'My Wallet (Self)' : `External Wallet (${abbreviateAddress(cleanAddr)})`,
          walletAddress: cleanAddr,
        });
      }
    } catch {
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

      const data = await safeParseJson(res);
      if (data && data.success && data.assessment) {
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
      const resultTx = await transferFunds({
        receiverUid: selectedRecipient.uid || undefined,
        receiverAddress: selectedRecipient.walletAddress,
        receiverUsername: selectedRecipient.username !== 'external' ? selectedRecipient.username : undefined,
        receiverDisplayName: selectedRecipient.displayName,
        amount: numericAmount,
        currency: 'HSCT',
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
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 md:p-12 font-sans flex flex-col items-center justify-center relative pb-28 md:pb-12">
      <div className="w-full max-w-xl">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <Link
            href="/wallet"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-[#FEEF8B] transition-colors text-xs sm:text-sm font-semibold min-h-[44px]"
          >
            <ArrowLeft size={16} />
            Back to Wallet
          </Link>

          <div className="flex items-center gap-2 bg-[#FEEF8B]/10 px-3 py-1 rounded-full border border-[#FEEF8B]/20">
            <span className="w-2 h-2 rounded-full bg-[#FEEF8B] animate-pulse"></span>
            <span className="text-[11px] text-[#FEEF8B] font-mono font-bold">SecureChain PoA Ledger</span>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-[#FEEF8B]/20 rounded-3xl p-5 sm:p-8 md:p-10 shadow-[0_12px_48px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Ambient Lighting */}
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#FEEF8B]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-[#F5C542]/5 rounded-full blur-3xl pointer-events-none" />

          {/* STEP 1: RECIPIENT SELECTION & CHANNELS */}
          {step === 'select_recipient' && (
            <div className="relative z-10 space-y-6 animate-in fade-in duration-300">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FEEF8B]/10 text-[#FEEF8B] rounded-full text-xs font-semibold border border-[#FEEF8B]/20">
                    <Sparkles size={13} /> Step 1 of 3: Recipient
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-semibold border border-emerald-500/20">
                    <span>⚡ HSCT Settlement Only (0% Gas)</span>
                  </div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Send Money</h1>
                <p className="text-neutral-400 text-xs sm:text-sm mt-1">
                  Choose a recipient by username, QR code scan, wallet address, or select your verified friends.
                </p>
              </div>

              {/* PRIORITY #1: VERIFIED FRIENDS QUICK SELECTION */}
              <div className="p-4 bg-gradient-to-r from-[#141414] via-[#16140b] to-[#141414] border border-[#FEEF8B]/30 rounded-2xl space-y-3 shadow-[0_0_20px_rgba(254,239,139,0.06)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FEEF8B] shadow-[0_0_8px_#FEEF8B] animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#FEEF8B] flex items-center gap-1.5">
                      <Star size={13} className="fill-[#FEEF8B]" /> Priority #1: Friends List
                    </span>
                  </div>
                  <Link
                    href="/friends"
                    className="text-[11px] text-[#FEEF8B]/90 hover:text-[#FEEF8B] hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Manage Friends ({friends.length})</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>

                {isLoadingFriends ? (
                  <div className="flex items-center justify-center py-4 text-xs text-neutral-400 gap-2">
                    <div className="w-4 h-4 border-2 border-[#FEEF8B] border-t-transparent rounded-full animate-spin" />
                    <span>Loading friends priority list...</span>
                  </div>
                ) : friends.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {friends.map((f) => (
                      <button
                        key={f.walletAddress}
                        type="button"
                        onClick={() =>
                          handleSelectRecipient({
                            uid: f.friendUid || f.uid,
                            username: f.username,
                            displayName: f.displayName,
                            walletAddress: f.walletAddress,
                            avatarUrl: f.avatarUrl,
                          })
                        }
                        className="p-3 bg-black/60 hover:bg-[#FEEF8B]/10 border border-white/5 hover:border-[#FEEF8B]/60 rounded-xl flex items-center gap-2.5 text-left transition-all group min-h-[52px]"
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#FEEF8B]/20 text-[#FEEF8B] font-bold text-xs flex items-center justify-center flex-shrink-0 border border-[#FEEF8B]/40 group-hover:scale-105 transition-transform">
                          {f.displayName?.charAt(0).toUpperCase() || 'F'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white group-hover:text-[#FEEF8B] truncate transition-colors">
                            {f.displayName}
                          </p>
                          <p className="text-[10px] text-neutral-400 font-mono truncate">
                            @{f.username}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
                    <p className="text-xs text-neutral-400">
                      Add friends for instant 1-tap Priority #1 transfers!
                    </p>
                    <Link
                      href="/friends"
                      className="px-2.5 py-1 bg-[#FEEF8B]/10 hover:bg-[#FEEF8B]/20 text-[#FEEF8B] border border-[#FEEF8B]/30 rounded-lg text-xs font-bold transition-colors"
                    >
                      + Add Friend
                    </Link>
                  </div>
                )}
              </div>

              {/* 4 Selection Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-[#121212] border border-white/5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setRecipientTab('search')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                    recipientTab === 'search'
                      ? 'bg-[#FEEF8B] text-black shadow-[0_0_12px_rgba(254,239,139,0.25)]'
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
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                    recipientTab === 'qr'
                      ? 'bg-[#FEEF8B] text-black shadow-[0_0_12px_rgba(254,239,139,0.25)]'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <QrCode size={15} />
                  <span>Scan QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRecipientTab('address')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                    recipientTab === 'address'
                      ? 'bg-[#FEEF8B] text-black shadow-[0_0_12px_rgba(254,239,139,0.25)]'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <LinkIcon size={15} />
                  <span>Address</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRecipientTab('recent')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                    recipientTab === 'recent'
                      ? 'bg-[#FEEF8B] text-black shadow-[0_0_12px_rgba(254,239,139,0.25)]'
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
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Enter @username, Name, or contact..."
                        className="w-full bg-[#121212] border border-white/10 text-white py-3.5 pl-11 pr-4 rounded-2xl focus:outline-none focus:border-[#FEEF8B]/60 focus:ring-1 focus:ring-[#FEEF8B]/30 transition-all placeholder:text-neutral-600 text-sm font-medium"
                        autoFocus
                      />
                      {isSearching && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <div className="w-5 h-5 border-2 border-[#FEEF8B] border-t-transparent rounded-full animate-spin"></div>
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
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Verified Contacts</p>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        {searchResults.map((u) => (
                          <div
                            key={u.uid}
                            onClick={() => handleSelectRecipient(u)}
                            className="flex items-center justify-between p-3.5 bg-[#121212] hover:bg-[#1a1a1a] border border-white/5 hover:border-[#FEEF8B]/40 rounded-2xl cursor-pointer transition-all group shadow-sm min-h-[56px]"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-[#FEEF8B]/10 text-[#FEEF8B] border border-[#FEEF8B]/20 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                {u.displayName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-white text-xs sm:text-sm group-hover:text-[#FEEF8B] transition-colors truncate">
                                    {u.displayName}
                                  </p>
                                  {friends.some(
                                    (f) =>
                                      f.walletAddress.toLowerCase() === u.walletAddress.toLowerCase() ||
                                      f.username.toLowerCase() === u.username.toLowerCase()
                                  ) && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FEEF8B]/20 text-[#FEEF8B] border border-[#FEEF8B]/40 text-[9px] font-extrabold uppercase">
                                      <Star size={9} className="fill-[#FEEF8B]" /> Friend • Priority #1
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-neutral-400 font-mono truncate">
                                  @{u.username} • {abbreviateAddress(u.walletAddress)}
                                </p>
                              </div>
                            </div>
                            <div className="p-2 rounded-xl bg-white/5 group-hover:bg-[#FEEF8B] group-hover:text-black text-neutral-400 transition-colors">
                              <ArrowRight size={14} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: QR SCANNER */}
              {recipientTab === 'qr' && (
                <div className="p-6 bg-[#121212] border border-white/5 rounded-2xl text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#FEEF8B]/10 text-[#FEEF8B] border border-[#FEEF8B]/20 flex items-center justify-center mx-auto">
                    <QrCode size={26} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Scan Payment QR</h3>
                    <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                      Hold up the recipient&apos;s SecureChain Pay QR code or upload a QR screenshot.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setIsQRModalOpen(true)}
                    className="w-full py-4 bg-[#FEEF8B] text-black hover:bg-[#FDE047] rounded-xl font-bold text-xs shadow-[0_0_20px_rgba(254,239,139,0.25)] min-h-[44px]"
                  >
                    <QrCode size={16} className="mr-2" /> Launch Camera Scanner
                  </Button>
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
                      className="w-full bg-[#121212] border border-white/10 text-white py-3.5 px-4 font-mono text-xs sm:text-sm rounded-2xl focus:outline-none focus:border-[#FEEF8B]/60 focus:ring-1 focus:ring-[#FEEF8B]/30 transition-all placeholder:text-neutral-600"
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
                    className="w-full py-4 bg-[#FEEF8B] text-black hover:bg-[#FDE047] rounded-xl font-bold text-xs disabled:opacity-50 min-h-[44px]"
                  >
                    {isResolvingAddress ? 'Resolving Address...' : 'Resolve Recipient →'}
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
                          className="p-3.5 bg-[#121212] hover:bg-[#1a1a1a] border border-white/5 hover:border-[#FEEF8B]/40 rounded-2xl cursor-pointer transition-all flex items-center gap-3 min-h-[54px]"
                        >
                          <div className="w-10 h-10 rounded-xl bg-[#FEEF8B]/10 flex items-center justify-center text-[#FEEF8B] font-bold text-sm flex-shrink-0 border border-[#FEEF8B]/20">
                            {rec.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white text-xs truncate">{rec.name}</p>
                            <p className="text-[10px] font-mono text-neutral-400 truncate mt-0.5">{abbreviateAddress(rec.address)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-neutral-400 bg-[#121212] rounded-2xl border border-white/5">
                      No recent transaction recipients found.
                    </div>
                  )}
                </div>
              )}

              {/* Available Balance Box */}
              <div className="p-3.5 rounded-2xl bg-[#121212] border border-white/5 flex items-center justify-between text-xs text-neutral-400">
                <span className="flex items-center gap-1.5"><Wallet size={14} className="text-[#FEEF8B]" /> Available Balance:</span>
                <span className="font-bold text-white text-xs sm:text-sm font-mono">{availableBalanceHsct.toLocaleString()} HSCT</span>
              </div>
            </div>
          )}

          {/* STEP 2: ENTER AMOUNT */}
          {step === 'enter_amount' && selectedRecipient && (
            <form onSubmit={handleProceedToConfirm} className="relative z-10 space-y-6 animate-in fade-in duration-300">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FEEF8B]/10 text-[#FEEF8B] rounded-full text-xs font-semibold border border-[#FEEF8B]/20 mb-3">
                  <Sparkles size={13} /> Step 2 of 3: Transfer Amount
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Enter Amount</h1>
                <p className="text-neutral-400 text-xs sm:text-sm mt-1">Specify how much HSCT you want to transfer.</p>
              </div>

              {/* Verified Recipient Profile Card */}
              <div className="flex items-center justify-between p-4 bg-[#121212] border border-[#FEEF8B]/25 rounded-2xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#FEEF8B] text-black flex items-center justify-center font-black text-sm flex-shrink-0 shadow-[0_0_12px_rgba(254,239,139,0.3)]">
                    {selectedRecipient.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#FEEF8B] font-bold uppercase tracking-wider">Sending To</p>
                    <p className="font-bold text-white text-xs sm:text-sm truncate">
                      {selectedRecipient.displayName} {selectedRecipient.username && selectedRecipient.username !== 'external' ? `(@${selectedRecipient.username})` : ''}
                    </p>
                    <p className="text-[11px] font-mono text-neutral-400 truncate">{abbreviateAddress(selectedRecipient.walletAddress)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('select_recipient');
                    setSelectedRecipient(null);
                  }}
                  className="text-xs text-[#FEEF8B] hover:text-white font-semibold underline underline-offset-4 min-h-[36px] flex items-center"
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
                    className="text-xs text-[#FEEF8B] hover:text-yellow-200 font-bold"
                  >
                    Use Max ({availableBalanceHsct.toLocaleString()} HSCT)
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="w-full bg-[#121212] border border-white/10 text-white text-3xl sm:text-4xl font-black py-5 px-6 rounded-2xl focus:outline-none focus:border-[#FEEF8B]/60 focus:ring-1 focus:ring-[#FEEF8B]/30 transition-all text-center placeholder:text-neutral-700"
                    autoFocus
                    required
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm sm:text-base text-neutral-400 font-bold font-mono">HSCT</span>
                </div>
              </div>

              {/* Preset Chips */}
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setAmount(preset.toString())}
                    className={`py-2.5 rounded-xl font-bold text-xs border transition-all min-h-[44px] ${
                      amount === preset.toString()
                        ? 'bg-[#FEEF8B] text-black border-[#FEEF8B] shadow-[0_0_15px_rgba(254,239,139,0.3)]'
                        : 'bg-[#121212] border-white/5 text-neutral-300 hover:bg-[#1a1a1a] hover:text-white'
                    }`}
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>

              {/* Note Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Note / Memo (Optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Payment for lunch, Invoice #102..."
                  className="w-full bg-[#121212] border border-white/10 text-white py-3 px-4 rounded-xl focus:outline-none focus:border-[#FEEF8B]/50 text-xs sm:text-sm placeholder:text-neutral-600"
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
                  className="w-1/3 py-4 bg-transparent border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 rounded-2xl font-bold text-xs min-h-[48px]"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={!numericAmount || numericAmount <= 0 || numericAmount > availableBalanceHsct}
                  className="w-2/3 py-4 bg-[#FEEF8B] text-black hover:bg-[#FDE047] rounded-2xl font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(254,239,139,0.25)] disabled:opacity-50 min-h-[48px]"
                >
                  Review Transfer <ArrowRight size={16} className="ml-1.5" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 3: REVIEW & PRE-FLIGHT */}
          {step === 'confirm_payment' && selectedRecipient && (
            <div className="relative z-10 space-y-6 animate-in fade-in duration-300">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FEEF8B]/10 text-[#FEEF8B] rounded-full text-xs font-semibold border border-[#FEEF8B]/20 mb-3">
                  <Lock size={13} /> Step 3 of 3: Final Review
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Review Transfer</h1>
                <p className="text-neutral-400 text-xs sm:text-sm mt-1">
                  Review transaction parameters before launching the secure verification signer.
                </p>
              </div>

              {/* Recipient Details Highlight Box */}
              <div className="bg-[#121212] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-inner">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Recipient</span>
                  <div className="text-right">
                    <p className="font-extrabold text-white text-xs sm:text-sm">{selectedRecipient.displayName}</p>
                    {selectedRecipient.username && selectedRecipient.username !== 'external' && (
                      <p className="text-[11px] text-[#FEEF8B] font-mono">@{selectedRecipient.username}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-2.5 gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Wallet Address</span>
                  <p className="font-mono text-xs text-neutral-300 break-all text-left sm:text-right max-w-full sm:max-w-[280px]">
                    {selectedRecipient.walletAddress}
                  </p>
                </div>

                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Transfer Amount</span>
                  <p className="font-black text-xl text-[#FEEF8B] font-mono">{numericAmount.toLocaleString()} HSCT</p>
                </div>

                <div className="flex items-center justify-between border-b border-white/5 pb-2.5 text-xs">
                  <span className="font-medium text-neutral-400">Network Gas Fee</span>
                  <span className="text-emerald-400 font-bold">0.00 (Zero Gas / PoA)</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="font-bold text-neutral-200">Total Debit</span>
                  <span className="text-white font-extrabold text-sm sm:text-base font-mono">{numericAmount.toLocaleString()} HSCT</span>
                </div>
              </div>

              {note && (
                <div className="p-3 bg-[#121212] rounded-xl border border-white/5 text-xs text-neutral-400">
                  <span className="font-semibold text-neutral-300">Note:</span> {note}
                </div>
              )}

              {/* Security Notice */}
              <div className="p-3.5 bg-[#FEEF8B]/5 border border-[#FEEF8B]/20 rounded-xl flex items-start gap-3 text-xs text-neutral-300">
                <ShieldCheck className="text-[#FEEF8B] flex-shrink-0 mt-0.5" size={18} />
                <p>
                  Cryptographic verification is required. You will confirm the authorized signing in the next step.
                </p>
              </div>

              {transferError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{transferError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => setStep('enter_amount')}
                  className="w-full sm:w-1/3 py-4 bg-transparent border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 rounded-2xl font-bold min-h-[48px]"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsVerificationModalOpen(true)}
                  className="w-full sm:w-2/3 py-4 bg-[#FEEF8B] hover:bg-[#FDE047] text-black font-extrabold text-xs sm:text-sm rounded-2xl shadow-[0_0_24px_rgba(254,239,139,0.3)] min-h-[48px]"
                >
                  Proceed to Final Verification →
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS STATE */}
          {step === 'success' && selectedRecipient && (
            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-6 py-4 animate-in zoom-in-95 duration-400">
              <div className="w-18 h-18 sm:w-20 sm:h-20 bg-[#FEEF8B]/15 text-[#FEEF8B] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(254,239,139,0.3)] border border-[#FEEF8B]/30">
                <CheckCircle2 size={42} />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1">Payment Sent!</h2>
                <p className="text-neutral-400 text-xs sm:text-sm">
                  Transferred <span className="text-[#FEEF8B] font-bold">{numericAmount.toLocaleString()} HSCT</span> to {selectedRecipient.displayName}
                </p>
              </div>

              {/* Transaction Receipt Card */}
              <div className="bg-[#121212] border border-white/10 rounded-2xl p-5 w-full text-left space-y-3 font-mono text-xs">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-neutral-400 font-sans">Recipient</span>
                  <span className="text-white font-bold">{selectedRecipient.displayName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-neutral-400 font-sans">Recipient Wallet</span>
                  <span className="text-[#FEEF8B]">{abbreviateAddress(selectedRecipient.walletAddress)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-neutral-400 font-sans">Transaction ID</span>
                  <span className="text-neutral-300">{completedTx?.id || 'TX_CONFIRMED'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-neutral-400 font-sans">Global Block</span>
                  <span className="text-[#FEEF8B] font-bold">#{completedTx?.blockNumber ?? 1}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-neutral-400 font-sans">Blockchain Status</span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold">
                    CONFIRMED ON-CHAIN ✓
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full pt-1">
                <Button
                  onClick={() => router.push('/explorer')}
                  className="py-4 bg-white text-black hover:bg-neutral-200 font-bold rounded-2xl text-xs shadow-md min-h-[44px]"
                >
                  View in Explorer <ExternalLink size={14} className="ml-1.5" />
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
                  className="py-4 bg-transparent border-white/10 text-white hover:bg-white/5 font-bold rounded-2xl text-xs min-h-[44px]"
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

      {/* Verification Popup Modal */}
      {selectedRecipient && (
        <VerificationPopup
          isOpen={isVerificationModalOpen}
          onClose={() => setIsVerificationModalOpen(false)}
          details={{
            recipientName: selectedRecipient.displayName,
            recipientAddress: selectedRecipient.walletAddress,
            recipientType: selectedRecipient.uid ? 'INTERNAL_USER' : 'EXTERNAL_WALLET',
            amount: numericAmount,
            asset: 'HSCT',
            network: 'SecureChain PoA Hybrid Ledger',
            memo: note || undefined,
          }}
          onConfirmSign={async () => {
            setIsVerificationModalOpen(false);
            await handleConfirmAndSend();
          }}
        />
      )}
    </div>
  );
}
