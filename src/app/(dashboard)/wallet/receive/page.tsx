'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWalletStore } from '@/stores/wallet-store';
import { useAuthStore } from '@/stores/auth-store';
import {
  Copy,
  Check,
  ArrowLeft,
  ShieldCheck,
  QrCode,
  Sparkles,
  Download,
  Share2,
  Send,
  Clock,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  FileText,
  User,
  CheckCircle2,
} from 'lucide-react';
import { generateQRDataURL } from '@/lib/qr/qr-service';

export default function ReceivePage() {
  const { address } = useWalletStore();
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<'receive' | 'request'>('receive');
  const [copied, setCopied] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<'HSCT' | 'ETH' | 'BTC'>('HSCT');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Request Money Form States
  const [requestAmount, setRequestAmount] = useState('');
  const [requestAsset, setRequestAsset] = useState<'HSCT' | 'ETH' | 'BTC'>('HSCT');
  const [requestNetwork, setRequestNetwork] = useState('SecureChain PoA');
  const [requestPayer, setRequestPayer] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [requestExpiresIn, setRequestExpiresIn] = useState(48); // hours
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<any | null>(null);
  const [requestQrUrl, setRequestQrUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Generate wallet receiving QR code
  useEffect(() => {
    if (!address) return;
    generateQRDataURL({
      address,
      uid: user?.id,
      username: user?.username,
      displayName: user?.name || user?.username || 'SecureChain User',
      currency: selectedAsset,
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR Code:', err));
  }, [address, user, selectedAsset]);

  // Generate request specific QR code when created
  useEffect(() => {
    if (!createdRequest || !address) return;
    generateQRDataURL({
      address: createdRequest.requestorWalletAddress || address,
      uid: user?.id,
      username: user?.username,
      displayName: user?.name || user?.username || 'SecureChain User',
      amount: createdRequest.amount,
      currency: createdRequest.currency || createdRequest.asset,
    })
      .then((url) => setRequestQrUrl(url))
      .catch((err) => console.error('Failed to generate Request QR Code:', err));
  }, [createdRequest, address, user]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShare = async () => {
    if (!address) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Pay with SecureChain Pay',
          text: `Send ${selectedAsset} to my SecureChain Pay wallet (${user?.username ? `@${user.username}` : address})`,
          url: window.location.href,
        });
      } catch {
        // Ignored or cancelled
      }
    } else {
      handleCopy(address);
    }
  };

  const handleDownloadQR = () => {
    const url = activeTab === 'receive' ? qrDataUrl : requestQrUrl;
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `SecureChainPay_${activeTab === 'receive' ? 'Wallet' : 'Request'}_${user?.username || 'QR'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setRequestError('Please log in to create a payment request');
      return;
    }
    const numAmount = parseFloat(requestAmount);
    if (!numAmount || numAmount <= 0) {
      setRequestError('Please enter a valid amount greater than 0');
      return;
    }

    setIsSubmittingRequest(true);
    setRequestError(null);

    try {
      const res = await fetch('/api/wallet/request-money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestorUid: user.id,
          receiverWalletAddress: address,
          amount: numAmount,
          currency: requestAsset,
          asset: requestAsset,
          network: requestNetwork,
          note: requestNote.trim() || undefined,
          expiresInHours: requestExpiresIn,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create payment request');
      }

      setCreatedRequest(data.request);
    } catch (err: any) {
      setRequestError(err?.message || 'Error generating payment request');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const getRequestShareUrl = () => {
    if (!createdRequest) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/wallet/transfer?requestId=${createdRequest.id}&recipient=${encodeURIComponent(
      createdRequest.requestorWalletAddress || address || ''
    )}&amount=${createdRequest.amount}&asset=${createdRequest.currency}`;
  };

  return (
    <div className="min-h-screen text-white p-4 sm:p-6 md:p-10 font-sans flex flex-col items-center relative pb-32 md:pb-12">
      <div className="w-full max-w-xl">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/wallet"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium min-h-[44px]"
          >
            <ArrowLeft size={18} />
            Back to Wallet
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-full text-xs font-semibold">
            <ShieldCheck size={14} /> Instant Settlement
          </div>
        </div>

        {/* Tab Switcher: Receive vs Request Money */}
        <div className="flex p-1.5 bg-[#121212] border border-white/10 rounded-2xl mb-6 shadow-inner">
          <button
            onClick={() => setActiveTab('receive')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
              activeTab === 'receive'
                ? 'bg-brand-primary text-neutral-950 shadow-md font-extrabold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <QrCode size={16} />
            Receive Money
          </button>
          <button
            onClick={() => setActiveTab('request')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
              activeTab === 'request'
                ? 'bg-brand-primary text-neutral-950 shadow-md font-extrabold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Send size={16} className="rotate-45" />
            Request Money
          </button>
        </div>

        {/* TAB 1: RECEIVE MONEY */}
        {activeTab === 'receive' && (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden space-y-6 animate-in fade-in duration-300">
            {/* Subtle Light-Yellow Ambient Glow */}
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="text-center relative z-10 space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Receive <span className="text-brand-primary">{selectedAsset}</span>
              </h1>
              <p className="text-neutral-400 text-xs sm:text-sm max-w-sm mx-auto">
                Scan this QR code from any camera or wallet to receive zero-gas instant payments.
              </p>
            </div>

            {/* Asset Selector Chips */}
            <div className="flex items-center justify-center gap-2 relative z-10">
              {(['HSCT', 'ETH', 'BTC'] as const).map((asset) => (
                <button
                  key={asset}
                  onClick={() => setSelectedAsset(asset)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all min-h-[38px] ${
                    selectedAsset === asset
                      ? 'bg-brand-primary/20 border border-brand-primary/40 text-brand-primary'
                      : 'bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {asset}
                </button>
              ))}
            </div>

            {/* Focal QR Card with Light-Yellow Aura */}
            <div className="flex flex-col items-center justify-center p-6 bg-[#121212] border border-brand-primary/20 rounded-2xl relative z-10 shadow-lg group">
              <div className="p-3 sm:p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center ring-4 ring-brand-primary/30 transition-transform duration-300 hover:scale-[1.02]">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="SecureChain Pay QR Code"
                    className="w-44 h-44 sm:w-52 sm:h-52 rounded-lg object-contain"
                  />
                ) : (
                  <div className="w-44 h-44 sm:w-52 sm:h-52 flex flex-col items-center justify-center bg-gray-100 text-neutral-600 text-xs font-mono rounded-lg gap-2">
                    <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                    Generating QR...
                  </div>
                )}
              </div>

              <div className="mt-4 text-center">
                <p className="text-xs text-neutral-400 font-medium">
                  Scan to send to{' '}
                  <span className="text-white font-bold">
                    {user?.username ? `@${user.username}` : user?.name || 'Wallet Account'}
                  </span>
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-1 text-[11px] text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Direct Non-Custodial Address
                </div>
              </div>

              {/* QR Actions: Download & Share */}
              {qrDataUrl && (
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/5 w-full justify-center">
                  <button
                    onClick={handleDownloadQR}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold text-white transition-all min-h-[44px]"
                  >
                    <Download size={14} /> Download QR
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 rounded-xl text-xs font-bold text-brand-primary transition-all min-h-[44px]"
                  >
                    <Share2 size={14} /> Share
                  </button>
                </div>
              )}
            </div>

            {/* Wallet Address Box */}
            <div className="space-y-2 relative z-10">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Your Public Wallet Address
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center bg-black border border-white/10 rounded-xl overflow-hidden p-1.5 focus-within:border-brand-primary/50 transition-colors gap-2 sm:gap-0">
                <span className="px-3 py-2 text-xs font-mono text-neutral-300 break-all sm:truncate flex-1 select-all">
                  {address || '0x...'}
                </span>
                <button
                  onClick={() => address && handleCopy(address)}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all min-h-[44px] ${
                    copied
                      ? 'bg-brand-primary text-neutral-950 shadow-[0_0_15px_rgba(254,239,139,0.3)]'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check size={14} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy Address
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-4 bg-brand-primary/5 border border-brand-primary/15 rounded-2xl text-xs text-neutral-400 space-y-1 relative z-10">
              <p className="font-semibold text-white flex items-center gap-1.5">
                <Sparkles size={14} className="text-brand-primary flex-shrink-0" /> Web3 Native & Instant
              </p>
              <p>
                Inbound transfers settle directly into your non-custodial local state with zero gas fees through our
                high-throughput PoA validator engine.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: REQUEST MONEY */}
        {activeTab === 'request' && (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden space-y-6 animate-in fade-in duration-300">
            {/* Ambient Glow */}
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />

            {!createdRequest ? (
              /* Request Creation Form */
              <form onSubmit={handleCreateRequest} className="space-y-5 relative z-10">
                <div className="text-center space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Request Money</h1>
                  <p className="text-neutral-400 text-xs sm:text-sm">
                    Generate a branded payment link and custom QR code for requested amounts.
                  </p>
                </div>

                {requestError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    <span>{requestError}</span>
                  </div>
                )}

                {/* Amount & Asset */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Amount & Currency
                  </label>
                  <div className="flex items-center bg-black border border-white/10 rounded-xl p-2 focus-within:border-brand-primary/50 transition-colors">
                    <span className="px-3 text-lg font-bold text-brand-primary">
                      {requestAsset === 'ETH' ? 'Ξ' : requestAsset === 'BTC' ? '₿' : '⚡'}
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value)}
                      className="bg-transparent border-none text-xl sm:text-2xl font-bold text-white focus:outline-none flex-1 placeholder:text-neutral-600"
                    />
                    <select
                      value={requestAsset}
                      onChange={(e) => setRequestAsset(e.target.value as any)}
                      className="bg-[#121212] text-white text-xs font-bold px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-brand-primary"
                    >
                      <option value="HSCT">HSCT</option>
                      <option value="ETH">ETH</option>
                      <option value="BTC">BTC</option>
                    </select>
                  </div>

                  {/* Preset Amount Chips */}
                  <div className="flex items-center gap-2 pt-1">
                    {['10', '50', '100', '500'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setRequestAmount(val)}
                        className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-neutral-300 transition-colors min-h-[36px]"
                      >
                        +{val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Network */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Settlement Network
                  </label>
                  <select
                    value={requestNetwork}
                    onChange={(e) => setRequestNetwork(e.target.value)}
                    className="w-full bg-black text-white text-xs font-semibold px-4 py-3 rounded-xl border border-white/10 focus:outline-none focus:border-brand-primary min-h-[44px]"
                  >
                    <option value="SecureChain PoA">SecureChain PoA (0% Gas Fee, Instant)</option>
                    <option value="Ethereum">Ethereum Mainnet</option>
                    <option value="Polygon">Polygon POS</option>
                  </select>
                </div>

                {/* Optional Payer */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Target Payer (Optional)</span>
                    <span className="text-[11px] text-neutral-500 font-normal">Leave blank for public link</span>
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="e.g. rahul or 0xABCD...1234"
                      value={requestPayer}
                      onChange={(e) => setRequestPayer(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-brand-primary/50 placeholder:text-neutral-600 min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Optional Note / Purpose */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Note / Purpose (Optional)
                  </label>
                  <div className="relative">
                    <FileText size={16} className="absolute left-3.5 top-3.5 text-neutral-500" />
                    <textarea
                      rows={2}
                      placeholder="e.g. Dinner bill split, Freelance invoice"
                      value={requestNote}
                      onChange={(e) => setRequestNote(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-brand-primary/50 placeholder:text-neutral-600 resize-none"
                    />
                  </div>
                </div>

                {/* Expiration */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Link Expiration
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { hours: 24, label: '24 Hours' },
                      { hours: 48, label: '48 Hours' },
                      { hours: 168, label: '7 Days' },
                    ].map((item) => (
                      <button
                        key={item.hours}
                        type="button"
                        onClick={() => setRequestExpiresIn(item.hours)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
                          requestExpiresIn === item.hours
                            ? 'bg-brand-primary/20 border border-brand-primary/50 text-brand-primary'
                            : 'bg-white/5 border border-white/10 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="w-full py-3.5 px-4 bg-brand-primary hover:bg-brand-pale text-neutral-950 font-extrabold rounded-xl text-sm transition-all shadow-lg hover:shadow-brand-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
                >
                  {isSubmittingRequest ? (
                    <>
                      <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                      Creating Request...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Generate Payment Request
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* REQUEST CREATED STATE */
              <div className="space-y-6 relative z-10 text-center animate-in zoom-in-95 duration-300">
                <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full mb-1">
                  <CheckCircle2 size={32} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-widest font-extrabold text-brand-primary">
                    REQUEST CREATED
                  </span>
                  <h2 className="text-3xl font-extrabold text-white">
                    {createdRequest.amount} {createdRequest.currency}
                  </h2>
                  {createdRequest.note && (
                    <p className="text-neutral-400 text-xs sm:text-sm italic">"{createdRequest.note}"</p>
                  )}
                </div>

                {/* Request Specific QR Card */}
                <div className="p-5 bg-[#121212] border border-brand-primary/25 rounded-2xl flex flex-col items-center space-y-3">
                  <div className="p-3 bg-white rounded-xl shadow-lg ring-4 ring-brand-primary/20">
                    {requestQrUrl ? (
                      <img
                        src={requestQrUrl}
                        alt="Payment Request QR"
                        className="w-40 h-40 sm:w-48 sm:h-48 rounded-lg"
                      />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center bg-gray-100 text-neutral-400 text-xs font-mono">
                        Generating QR...
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <Clock size={14} className="text-brand-primary" />
                    <span>Expires in {createdRequest.expiresAt ? '48 hours' : '2 days'}</span>
                  </div>
                </div>

                {/* Shareable Link Box */}
                <div className="space-y-2 text-left">
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Shareable Payment Link
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center bg-black border border-white/10 rounded-xl overflow-hidden p-1.5 gap-2 sm:gap-0">
                    <span className="px-3 py-2 text-xs font-mono text-neutral-300 break-all sm:truncate flex-1 select-all">
                      {getRequestShareUrl()}
                    </span>
                    <button
                      onClick={() => handleCopyLink(getRequestShareUrl())}
                      className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all min-h-[44px] ${
                        copiedLink
                          ? 'bg-brand-primary text-neutral-950 shadow-[0_0_15px_rgba(254,239,139,0.3)]'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {copiedLink ? (
                        <>
                          <Check size={14} /> Link Copied
                        </>
                      ) : (
                        <>
                          <Copy size={14} /> Copy Link
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-xl text-xs">
                  <span className="text-neutral-400">Request Status</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold uppercase text-[11px]">
                    {createdRequest.status || 'PENDING'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: 'Payment Request',
                          text: `Please pay ${createdRequest.amount} ${createdRequest.currency} via SecureChain Pay`,
                          url: getRequestShareUrl(),
                        });
                      } else {
                        handleCopyLink(getRequestShareUrl());
                      }
                    }}
                    className="flex-1 py-3 px-4 bg-brand-primary hover:bg-brand-pale text-neutral-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <Share2 size={16} /> Share Link
                  </button>
                  <button
                    onClick={() => {
                      setCreatedRequest(null);
                      setRequestAmount('');
                      setRequestNote('');
                    }}
                    className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl text-xs transition-all min-h-[44px]"
                  >
                    Create Another Request
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
