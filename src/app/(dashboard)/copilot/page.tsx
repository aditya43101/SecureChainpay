'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Zap,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  DollarSign,
  UserCheck,
  Cpu,
  Lock,
  ThumbsUp,
  ThumbsDown,
  Info,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Sliders,
  ExternalLink,
  QrCode,
  Copy,
  Check,
  Upload,
  Camera,
  Share2,
  X,
} from 'lucide-react';
import jsQR from 'jsqr';
import { VerificationPopup, PaymentVerificationDetails } from '@/components/wallet/VerificationPopup';
import { QRScannerModal } from '@/components/wallet/QRScannerModal';
import { resolveRecipientFromQR, ResolvedRecipient } from '@/lib/payments/recipient-resolver';
import { useWalletStore } from '@/stores/wallet-store';

interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  intent?: string;
  decisionId?: string;
  actionRequired?: string;
  draft?: any;
  paymentRequest?: any;
  preflight?: any;
  failureAnalysis?: any;
  paymentAudit?: any;
  quickReplies?: string[];
  feedback?: 'HELPFUL' | 'UNHELPFUL' | 'INCORRECT';
  timestamp: string;
}

export default function CopilotDashboard() {
  const { address: userWalletAddress, transferFunds, initializeWallet } = useWalletStore();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'copilot',
      text: "👋 Hello! I'm your **AI Payment Copilot**.\n\nI can help you **Send Money** (by username, wallet address, or QR), **Request Money** (creating payment QR codes and shareable links), evaluate settlement routing, and perform cryptographic security checks.\n\n*What would you like to do today?*",
      intent: 'GENERAL_QUESTION',
      quickReplies: [
        'Send $100 to Rahul',
        'Request ₹500 from Rahul',
        'Scan QR screenshot',
        'Check route latency',
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDraft, setActiveDraft] = useState<any>(null);
  const [draftCountdown, setDraftCountdown] = useState<number | null>(null);
  const [isConfirmingDraft, setIsConfirmingDraft] = useState(false);
  const [selectedTimeline, setSelectedTimeline] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<any>(null);

  // Modal States
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState<PaymentVerificationDetails | null>(null);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeDraft]);

  // Handle incoming Shareable Payment Request links (?request=REQ-... or ?pay=REQ-...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('request') || params.get('pay') || params.get('req');

    if (requestId) {
      fetchPaymentRequestByUrl(requestId);
    }
  }, []);

  // Draft TTL Countdown
  useEffect(() => {
    if (!activeDraft?.expiresAt) {
      setDraftCountdown(null);
      return;
    }

    const interval = setInterval(() => {
      const remainingMs = new Date(activeDraft.expiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setDraftCountdown(0);
        setActiveDraft((prev: any) => (prev ? { ...prev, status: 'EXPIRED' } : null));
        clearInterval(interval);
      } else {
        setDraftCountdown(Math.floor(remainingMs / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeDraft?.expiresAt]);

  // Fetch Payment Request from URL query parameter
  const fetchPaymentRequestByUrl = async (requestId: string) => {
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/payments/request/${requestId}`);
      const data = await res.json();

      if (data.success && data.request) {
        const req = data.request;
        const isExpired = req.status === 'EXPIRED' || (req.expiresAt && new Date(req.expiresAt) < new Date());
        const isPaid = req.status === 'PAID' || req.status === 'CONFIRMED';
        const isCancelled = req.status === 'CANCELLED';

        let statusText = `📌 **Incoming Payment Request: ${req.requestId}**\n\n• **Receiver**: ${req.receiverName || req.requestorDisplayName}\n• **Wallet**: \`${req.receiverWalletAddress || req.requestorWalletAddress}\`\n• **Amount**: ${req.amount} **${req.currency || req.asset}**\n• **Network**: ${req.network || 'Ethereum'}\n• **Status**: **${req.status}**`;

        if (isPaid) {
          statusText += `\n\n✅ *This payment request has already been paid.*`;
        } else if (isExpired) {
          statusText += `\n\n⚠️ *This payment request has expired and cannot be paid.*`;
        } else if (isCancelled) {
          statusText += `\n\n❌ *This payment request was cancelled by the receiver.*`;
        } else {
          statusText += `\n\nClick **Review Payment** below to proceed to final verification & secure signing.`;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `req-url-${Date.now()}`,
            sender: 'copilot',
            text: statusText,
            intent: 'REQUEST_PAYMENT',
            paymentRequest: req,
            quickReplies: req.status === 'PENDING' ? ['Review Payment', 'Decline Request'] : ['Send New Payment'],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err) {
      console.error('Error loading request from URL:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage;
    if (!query.trim() || isProcessing) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsProcessing(true);

    try {
      const res = await fetch('/api/ai/payment-copilot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });
      const data = await res.json();

      const copilotMsg: ChatMessage = {
        id: `cpl-${Date.now()}`,
        sender: 'copilot',
        text: data.message || 'I processed your request.',
        intent: data.intent,
        decisionId: data.decisionId,
        actionRequired: data.actionRequired,
        draft: data.draft,
        paymentRequest: data.paymentRequest,
        preflight: data.preflight,
        failureAnalysis: data.failureAnalysis,
        paymentAudit: data.paymentAudit,
        quickReplies: data.quickReplies,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, copilotMsg]);

      if (data.draft) {
        setActiveDraft(data.draft);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'copilot',
          text: `⚠️ Could not process request: ${err.message || 'Connection timeout.'}`,
          quickReplies: ['Retry', 'Check Route Status'],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Trigger Final Verification Popup for a draft or payment request
  const openVerificationForDraft = (draft: any) => {
    setVerificationDetails({
      recipientName: draft.recipientName || draft.recipient || 'Target Recipient',
      recipientAddress: draft.recipientAddress || draft.recipient || '0x0000000000000000000000000000000000000000',
      recipientType: (draft.recipient || '').startsWith('0x') ? 'EXTERNAL_WALLET' : 'INTERNAL_USER',
      amount: Number(draft.amount),
      asset: draft.currency || 'HSCT',
      network: draft.preferredRoute === 'INTERNAL' ? 'SecureChain Hybrid Ledger' : 'Ethereum Mainnet',
      memo: draft.description,
    });
    setIsVerificationOpen(true);
  };

  const openVerificationForRequest = (req: any) => {
    if (['PAID', 'CONFIRMED', 'EXPIRED', 'CANCELLED'].includes(req.status)) {
      alert(`This payment request is ${req.status} and cannot be paid.`);
      return;
    }

    setVerificationDetails({
      recipientName: req.receiverName || req.requestorDisplayName || 'Receiver',
      recipientAddress: req.receiverWalletAddress || req.requestorWalletAddress || '0x0000000000000000000000000000000000000000',
      recipientType: 'INTERNAL_USER',
      amount: Number(req.amount),
      asset: req.asset || req.currency || 'USD',
      network: req.network || 'Ethereum Mainnet',
      memo: req.memo || req.note,
      requestId: req.requestId || req.id,
    });
    setIsVerificationOpen(true);
  };

  // Mandatory Signing Handler called when user clicks [CONFIRM & SIGN] in VerificationPopup
  const handleExecutePaymentSigning = async (details: PaymentVerificationDetails) => {
    try {
      setIsConfirmingDraft(true);

      // Perform transfer with decrypted private key signature
      const completedTx = await transferFunds({
        receiverAddress: details.recipientAddress,
        receiverDisplayName: details.recipientName,
        amount: details.amount,
        currency: (details.asset as any) || 'HSCT',
        note: details.memo,
      });

      // Update payment request status if paying a request
      if (details.requestId) {
        await fetch('/api/wallet/request-money', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: details.requestId,
            action: 'PAID',
            transactionId: completedTx.id,
          }),
        }).catch(() => {});
      }

      setActiveDraft(null);
      setDraftCountdown(null);

      setMessages((prev) => [
        ...prev,
        {
          id: `conf-${Date.now()}`,
          sender: 'copilot',
          text: `🎉 **Payment Confirmed & Signed!**\n\n• **Amount**: ${details.amount} **${details.asset}**\n• **Recipient**: ${details.recipientName}\n• **Wallet Address**: \`${details.recipientAddress}\`\n• **Block Number**: #${completedTx.blockNumber}\n• **Transaction Hash**: \`${completedTx.hash.substring(0, 16)}...\`\n\nCryptographic signature verified and anchored to the global blockchain.`,
          quickReplies: ['Send Another Payment', 'Request Money', 'Check Balance'],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      console.error('Payment signing failed:', err);
      throw err;
    } finally {
      setIsConfirmingDraft(false);
    }
  };

  // QR Image Screenshot Upload Handler
  const handleQRFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleQRScanSuccess(resolveRecipientFromQR(code.data).recipient!);
          } else {
            alert('Could not detect a valid SecureChain Pay QR code in the uploaded image.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleQRScanSuccess = (recipient: ResolvedRecipient) => {
    setVerificationDetails({
      recipientName: recipient.displayName || recipient.username || 'Scanned QR Recipient',
      recipientAddress: recipient.walletAddress,
      recipientType: recipient.recipientType,
      amount: recipient.amount || 10,
      asset: recipient.currency || 'HSCT',
      network: 'SecureChain Hybrid Ledger',
    });
    setIsVerificationOpen(true);
  };

  const copyShareableLink = (link: string) => {
    const fullUrl = `${window.location.origin}${link}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400">
              <Bot className="h-7 w-7 animate-pulse" />
            </span>
            AI Payment Copilot
          </h1>
          <p className="text-neutral-400 mt-1 text-sm">
            Complete Two-Way Payment System: Send, Request, QR Scan, Mandatory Verification, & Blockchain Finality.
          </p>
        </div>

        {/* Live System Badges & QR Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsQRScannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)]"
          >
            <QrCode size={16} /> Scan Payment QR
          </button>

          <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 px-3 py-2 rounded-xl text-xs font-medium text-neutral-300">
            <Lock size={12} className="text-cyan-400" /> Key Signer Active
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Chat Stream */}
        <div className="lg:col-span-8 flex flex-col h-[720px] bg-neutral-900/60 border border-neutral-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
          {/* Header */}
          <div className="p-4 border-b border-neutral-800/80 bg-neutral-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-neutral-200">Payment Copilot Assistant</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={qrFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleQRFileUpload}
              />
              <button
                onClick={() => qrFileInputRef.current?.click()}
                className="text-xs text-neutral-400 hover:text-emerald-400 flex items-center gap-1 transition-colors px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10"
              >
                <Upload className="h-3 w-3" /> Upload QR Screenshot
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'copilot' && (
                  <div className="h-8 w-8 rounded-lg bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-1">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-none shadow-lg shadow-emerald-900/20'
                      : 'bg-neutral-800/90 text-neutral-200 rounded-bl-none border border-neutral-700/60'
                  }`}
                >
                  {/* Markdown Text */}
                  <div className="whitespace-pre-wrap space-y-2">
                    {msg.text.split('\n').map((line, i) => {
                      if (line.startsWith('• ') || line.startsWith('- ')) {
                        return (
                          <div key={i} className="flex items-start gap-2 pl-2">
                            <span className="text-emerald-400 mt-1">•</span>
                            <span
                              dangerouslySetInnerHTML={{
                                __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                              }}
                            />
                          </div>
                        );
                      }
                      return (
                        <p
                          key={i}
                          dangerouslySetInnerHTML={{
                            __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Payment Request Card Display */}
                  {msg.paymentRequest && (
                    <div className="mt-4 p-4 bg-neutral-950/90 border border-emerald-500/30 rounded-2xl space-y-4">
                      {msg.paymentRequest.qrDataUrl && (
                        <div className="flex flex-col items-center p-3 bg-white rounded-xl">
                          <img
                            src={msg.paymentRequest.qrDataUrl}
                            alt="Payment Request QR Code"
                            className="w-48 h-48 object-contain"
                          />
                          <span className="text-[10px] text-neutral-600 font-mono mt-1 font-bold">
                            Scan to Pay Request
                          </span>
                        </div>
                      )}

                      {msg.paymentRequest.shareableLink && (
                        <div className="space-y-2">
                          <span className="text-[11px] text-neutral-400 uppercase font-semibold block">Shareable Payment Link</span>
                          <div className="flex items-center gap-2 bg-black/60 p-2.5 rounded-xl border border-white/10 text-xs font-mono">
                            <span className="truncate text-emerald-400 flex-1">{`${window.location.origin}${msg.paymentRequest.shareableLink}`}</span>
                            <button
                              onClick={() => copyShareableLink(msg.paymentRequest.shareableLink)}
                              className="px-2.5 py-1 bg-emerald-500 text-black font-bold text-[11px] rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1"
                            >
                              {copiedLink === msg.paymentRequest.shareableLink ? <Check size={12} /> : <Copy size={12} />}
                              {copiedLink === msg.paymentRequest.shareableLink ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      )}

                      {msg.paymentRequest.status === 'PENDING' && (
                        <button
                          onClick={() => openVerificationForRequest(msg.paymentRequest)}
                          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        >
                          Review Payment →
                        </button>
                      )}
                    </div>
                  )}

                  {/* Payment Draft Action Card */}
                  {msg.draft && (
                    <div className="mt-4 p-4 bg-neutral-950/90 border border-cyan-500/30 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-400 font-medium">Prepared Draft</span>
                        <span className="text-emerald-400 font-bold font-mono">
                          {msg.draft.amount} {msg.draft.currency}
                        </span>
                      </div>
                      <button
                        onClick={() => openVerificationForDraft(msg.draft)}
                        className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        Proceed to Verification →
                      </button>
                    </div>
                  )}

                  {/* Meta footer */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-700/40 text-[11px] text-neutral-400">
                    <span>{msg.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-lg bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Bot className="h-4 w-4 animate-spin" />
                </div>
                <div className="bg-neutral-800/90 border border-neutral-700/60 rounded-2xl rounded-bl-none p-4 text-xs text-neutral-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Processing payment intent, resolving recipient, & preparing transaction verification...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {messages.length > 0 && messages[messages.length - 1].quickReplies && (
            <div className="px-4 py-2.5 border-t border-neutral-800/60 bg-neutral-950/40 flex gap-2 overflow-x-auto no-scrollbar">
              {messages[messages.length - 1].quickReplies?.map((pill, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(pill)}
                  className="px-3.5 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 border border-neutral-700/60 transition-colors whitespace-nowrap"
                >
                  {pill}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div className="p-4 border-t border-neutral-800 bg-neutral-950/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type payment command (e.g. 'Pay ₹500 to Rahul', 'Request $100', 'Send 0.01 ETH to 0x123...')"
                className="flex-1 bg-neutral-900 border border-neutral-700/80 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isProcessing}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Active Draft & Payment System Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Draft Panel */}
          <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800/90 backdrop-blur-md relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-cyan-400" />
                <h3 className="font-semibold text-neutral-100 text-sm">Active Draft</h3>
              </div>

              {activeDraft && draftCountdown !== null && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-500/30 text-xs font-mono">
                  <Clock size={12} /> {draftCountdown}s
                </div>
              )}
            </div>

            {activeDraft && activeDraft.status === 'DRAFT' ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-neutral-400">Amount</span>
                    <span className="text-2xl font-bold text-white">
                      {activeDraft.amount}{' '}
                      <span className="text-xs font-normal text-emerald-400">{activeDraft.currency}</span>
                    </span>
                  </div>

                  <div className="flex justify-between text-xs pt-2 border-t border-neutral-800/60">
                    <span className="text-neutral-400">Recipient</span>
                    <span className="text-neutral-200 font-medium truncate max-w-[180px]">
                      {activeDraft.recipient}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => openVerificationForDraft(activeDraft)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  <Lock size={14} /> Final Verification & Sign →
                </button>
              </div>
            ) : (
              <div className="mt-6 py-8 text-center text-xs text-neutral-500 space-y-2">
                <ShieldCheck className="h-8 w-8 text-neutral-700 mx-auto" />
                <p>No active payment draft queued.</p>
                <p className="text-[11px] text-neutral-600">
                  Ask Copilot to send or request money to prepare a transaction.
                </p>
              </div>
            )}
          </div>

          {/* Quick Payment Action Cards */}
          <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800/90 space-y-4">
            <h3 className="font-semibold text-neutral-100 text-sm flex items-center gap-2">
              <Zap size={16} className="text-emerald-400" /> Quick Payment Tools
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSendMessage('Request ₹500')}
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left space-y-1 transition-colors"
              >
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <QrCode size={14} className="text-emerald-400" /> Request Money
                </div>
                <p className="text-[10px] text-neutral-400">Generate Request QR & Share Link</p>
              </button>

              <button
                onClick={() => setIsQRScannerOpen(true)}
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left space-y-1 transition-colors"
              >
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <Camera size={14} className="text-cyan-400" /> Scan QR Code
                </div>
                <p className="text-[10px] text-neutral-400">Scan camera or image screenshot</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Final Verification Popup */}
      <VerificationPopup
        isOpen={isVerificationOpen}
        onClose={() => setIsVerificationOpen(false)}
        details={verificationDetails}
        onConfirmSign={handleExecutePaymentSigning}
      />

      {/* QR Scanner Camera Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScanSuccess={handleQRScanSuccess}
      />
    </div>
  );
}
