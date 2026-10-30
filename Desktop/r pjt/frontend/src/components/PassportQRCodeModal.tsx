'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Copy,
  Check,
  Printer,
  ExternalLink,
  X,
  ShieldCheck,
} from 'lucide-react';

interface PassportQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  passportId: string;
  vehicleTitle: string;
  vin?: string;
  registrationNumber?: string;
  blockchainStatus?: string;
  txHash?: string | null;
}

export function PassportQRCodeModal({
  isOpen,
  onClose,
  passportId,
  vehicleTitle,
  vin,
  registrationNumber,
}: PassportQRCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [publicUrl, setPublicUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !passportId) return;

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const url = `${origin}/verify/${passportId}`;
    setPublicUrl(url);

    QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a', // Slate 900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch((err) => console.error('Error generating QR code:', err));
  }, [isOpen, passportId]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${passportId}-verification-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Vehicle Passport QR</h2>
          <p className="text-xs text-slate-500 font-mono tracking-wide">{passportId}</p>
          <p className="text-sm font-semibold text-slate-800">{vehicleTitle}</p>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-100">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for ${passportId}`}
              className="w-56 h-56 rounded-lg shadow-sm border border-white"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-3 text-xs text-emerald-700 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Public Blockchain Verification URL</span>
          </div>
        </div>

        {/* URL Box */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 truncate flex items-center justify-between gap-2">
          <span className="truncate">{publicUrl}</span>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-sans font-medium px-2 py-1 rounded hover:bg-blue-50 transition shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Save PNG</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Card</span>
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Public</span>
          </a>
        </div>
      </div>
    </div>
  );
}
