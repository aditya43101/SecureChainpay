'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWalletStore } from '@/stores/wallet-store';
import { useAuthStore } from '@/stores/auth-store';
import { Copy, Check, ArrowLeft, ShieldCheck, QrCode, Sparkles, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateQRDataURL } from '@/lib/qr/qr-service';

export default function ReceivePage() {
  const { address } = useWalletStore();
  const user = useAuthStore((s) => s.user);

  const [copied, setCopied] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<'USD' | 'ETH' | 'BTC'>('USD');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

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

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `SecureChainPay_QR_${user?.username || 'Wallet'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              Share your payment QR code or wallet address to receive payments.
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

          {/* Scannable Real QR Code Card */}
          <div className="flex flex-col items-center justify-center p-6 bg-neutral-900/60 border border-white/10 rounded-2xl relative z-10 space-y-4">
            <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="SecureChain Pay QR Code" className="w-48 h-48 rounded-lg" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-gray-100 text-neutral-400 text-xs font-mono rounded-lg">
                  Generating QR...
                </div>
              )}
            </div>
            
            <p className="text-xs text-neutral-400 font-medium text-center">
              Scan to send <span className="text-emerald-400 font-bold">{selectedAsset}</span> directly to{' '}
              <span className="text-white font-bold">{user?.username ? `@${user.username}` : 'this wallet'}</span>
            </p>

            {/* QR Actions */}
            {qrDataUrl && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleDownloadQR}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold text-white transition-all"
                >
                  <Download size={14} /> Download QR
                </button>
              </div>
            )}
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
