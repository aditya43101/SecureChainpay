'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useWalletStore } from '@/stores/wallet-store';
import { Copy, Check, ArrowLeft, ShieldCheck, QrCode, Sparkles, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReceivePage() {
  const { address, publicKey } = useWalletStore();
  const [copied, setCopied] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<'USD' | 'ETH' | 'BTC'>('USD');

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans flex flex-col items-center justify-center relative pb-24 md:pb-12">
      <div className="w-full max-w-xl">
        <Link href="/wallet" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft size={18} />
          Back to Wallet
        </Link>

        <div className="bg-neutral-950/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden space-y-8">
          {/* Glowing Accents */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center relative z-10 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold mb-2">
              <ShieldCheck size={14} /> Instant Settlement Supported
            </div>
            <h1 className="text-3xl font-extrabold text-white">Receive Funds</h1>
            <p className="text-neutral-400 text-sm">
              Share your address or QR code to receive payments on SecureChain.
            </p>
          </div>

          {/* Asset Selection */}
          <div className="flex p-1 bg-black/50 border border-white/5 rounded-2xl relative z-10">
            {(['USD', 'ETH', 'BTC'] as const).map((asset) => (
              <button
                key={asset}
                onClick={() => setSelectedAsset(asset)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                  selectedAsset === asset
                    ? 'bg-white/10 text-white shadow-sm border border-white/10'
                    : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
                }`}
              >
                {asset}
              </button>
            ))}
          </div>

          {/* QR Code Card */}
          <div className="flex flex-col items-center justify-center p-6 bg-neutral-900/60 border border-white/10 rounded-2xl relative z-10 space-y-4">
            <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center">
              {/* Stylized QR Code SVG representing wallet address */}
              <svg width="180" height="180" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black">
                <rect width="100" height="100" fill="white" />
                <rect x="10" y="10" width="25" height="25" fill="black" />
                <rect x="15" y="15" width="15" height="15" fill="white" />
                <rect x="18" y="18" width="9" height="9" fill="black" />

                <rect x="65" y="10" width="25" height="25" fill="black" />
                <rect x="70" y="15" width="15" height="15" fill="white" />
                <rect x="73" y="18" width="9" height="9" fill="black" />

                <rect x="10" y="65" width="25" height="25" fill="black" />
                <rect x="15" y="70" width="15" height="15" fill="white" />
                <rect x="18" y="73" width="9" height="9" fill="black" />

                <rect x="40" y="15" width="8" height="8" fill="black" />
                <rect x="52" y="15" width="6" height="6" fill="black" />
                <rect x="40" y="27" width="15" height="6" fill="black" />
                <rect x="40" y="40" width="20" height="20" fill="black" />
                <rect x="45" y="45" width="10" height="10" fill="white" />

                <rect x="65" y="40" width="10" height="8" fill="black" />
                <rect x="80" y="40" width="8" height="12" fill="black" />
                <rect x="65" y="55" width="25" height="6" fill="black" />
                <rect x="65" y="65" width="12" height="12" fill="black" />
                <rect x="82" y="70" width="8" height="20" fill="black" />
                
                <rect x="15" y="42" width="15" height="6" fill="black" />
                <rect x="10" y="52" width="25" height="6" fill="black" />
                <rect x="40" y="65" width="8" height="25" fill="black" />
                <rect x="52" y="75" width="15" height="12" fill="black" />
              </svg>
            </div>
            
            <p className="text-xs text-neutral-400 font-medium">
              Scan to send <span className="text-emerald-400 font-bold">{selectedAsset}</span> directly to this wallet
            </p>
          </div>

          {/* Wallet Address Box */}
          <div className="space-y-2 relative z-10">
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Your Public Wallet Address
            </label>
            <div className="flex items-center bg-black/60 border border-neutral-800 rounded-xl overflow-hidden p-1.5 focus-within:border-emerald-500/50 transition-colors">
              <span className="px-3 py-2 text-xs font-mono text-neutral-300 truncate flex-1 select-all">
                {address || '0x...'}
              </span>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  copied
                    ? 'bg-emerald-500 text-neutral-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {copied ? (
                  <>
                    <Check size={14} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Information Notice */}
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-xs text-neutral-400 space-y-1 relative z-10">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles size={14} className="text-emerald-400" /> Non-Custodial & Encrypted
            </p>
            <p>
              Funds sent to this address are instantly indexed by the SecureChain local PoA engine with zero network gas fees.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
