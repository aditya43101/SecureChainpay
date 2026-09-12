'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Zap,
  Shield,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Sparkles,
  Lock,
  ChevronRight,
  QrCode,
  Copy,
  Check,
  Upload,
  Camera,
  ArrowRight,
  CreditCard,
  ExternalLink,
  DollarSign,
  User,
  Info,
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
  const { address: userWalletAddress, transferFunds } = useWalletStore();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'copilot',
      text: "👋 Hello! I'm your **Payment Copilot**.\n\nI can help you prepare transactions, generate request links & QR codes, analyze routing fees, and guide you through secure blockchain verification.\n\n*What would you like to do today?*",
      intent: 'GENERAL_QUESTION',
      quickReplies: [
        'Send $100 to Rahul',
        'Request ₹500',
        'Scan QR',
        'Check wallet',
        'Analyze payment',
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDraft, setActiveDraft] = useState<any>(null);
  const [draftCountdown, setDraftCountdown] = useState<number | null>(null);
  const [isConfirmingDraft, setIsConfirmingDraft] = useState(false);

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
        quickReplies: data.quickReplies || [
          'Send money',
          'Request money',
          'Scan QR',
          'Check wallet',
        ],
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
          quickReplies: ['Retry', 'Send money', 'Check wallet'],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const openVerificationForDraft = (draft: any) => {
    setVerificationDetails({
      recipientName: draft.recipientName || draft.recipient || 'Target Recipient',
      recipientAddress: draft.recipientAddress || draft.recipient || '0x0000000000000000000000000000000000000000',
      recipientType: (draft.recipient || '').startsWith('0x') ? 'EXTERNAL_WALLET' : 'INTERNAL_USER',
      amount: Number(draft.amount),
      asset: draft.currency || 'HSCT',
      network: draft.preferredRoute === 'INTERNAL' ? 'SecureChain PoA' : 'Ethereum Mainnet',
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
      asset: req.asset === 'USD' || req.currency === 'USD' ? 'HSCT' : (req.asset || req.currency || 'HSCT'),
      network: req.network || 'SecureChain Hybrid Ledger',
      memo: req.memo || req.note,
      requestId: req.requestId || req.id,
    });
    setIsVerificationOpen(true);
  };

  const handleExecutePaymentSigning = async (details: PaymentVerificationDetails) => {
    try {
      setIsConfirmingDraft(true);

      const completedTx = await transferFunds({
        receiverAddress: details.recipientAddress,
        receiverDisplayName: details.recipientName,
        amount: details.amount,
        currency: (details.asset as any) || 'HSCT',
        note: details.memo,
      });

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
          text: `🎉 **Payment Confirmed & Signed!**\n\n• **Amount**: ${details.amount} **${details.asset}**\n• **Recipient**: ${details.recipientName}\n• **Wallet Address**: \`${details.recipientAddress}\`\n• **Block Number**: #${completedTx.blockNumber}\n• **Transaction Hash**: \`${completedTx.hash.substring(0, 16)}...\`\n\nCryptographic signature verified and recorded in the blockchain ledger.`,
          quickReplies: ['Send Another Payment', 'Request Money', 'Check wallet'],
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
      network: 'SecureChain PoA',
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
    <div className="space-y-6 max-w-7xl mx-auto pb-28 md:pb-12 text-white">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span className="p-2 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
              <Bot className="h-6 w-6" />
            </span>
            Payment Copilot
          </h1>
          <p className="text-neutral-400 mt-1 text-xs sm:text-sm">
            AI-powered fintech assistant for natural-language payments, QR transfers, and instant verification.
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsQRScannerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/20 rounded-xl text-xs font-bold transition-all min-h-[44px]"
          >
            <QrCode size={16} /> Scan Payment QR
          </button>
          <div className="hidden sm:flex items-center gap-1.5 bg-[#121212] border border-white/10 px-3 py-2 rounded-xl text-xs font-medium text-neutral-300">
            <Lock size={13} className="text-brand-primary" /> Key Signer Active
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Chat Area */}
        <div className="lg:col-span-8 flex flex-col h-[680px] sm:h-[720px] bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-xl relative">
          {/* Header Strip */}
          <div className="p-3.5 sm:p-4 border-b border-white/10 bg-[#121212]/70 flex items-center justify-between backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-primary" />
              <span className="text-xs sm:text-sm font-bold text-white">Payment Copilot Assistant</span>
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
                className="text-xs text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 min-h-[36px]"
              >
                <Upload className="h-3.5 w-3.5 text-brand-primary" />
                <span className="hidden sm:inline">Upload QR Screenshot</span>
                <span className="sm:hidden">Upload QR</span>
              </button>
            </div>
          </div>

          {/* Messages Scroll View */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'copilot' && (
                  <div className="h-8 w-8 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0 mt-1">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-brand-primary text-neutral-950 font-medium rounded-br-none shadow-md'
                      : 'bg-[#121212] text-neutral-200 rounded-bl-none border border-white/10'
                  }`}
                >
                  {/* Markdown Lines */}
                  <div className="whitespace-pre-wrap space-y-2">
                    {msg.text.split('\n').map((line, i) => {
                      if (line.startsWith('• ') || line.startsWith('- ')) {
                        return (
                          <div key={i} className="flex items-start gap-2 pl-2">
                            <span className={msg.sender === 'user' ? 'text-neutral-800' : 'text-brand-primary'}>
                              •
                            </span>
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

                  {/* SECTION 14: STRUCTURED PAYMENT CARD FOR DRAFT */}
                  {msg.draft && (
                    <div className="mt-4 p-4 bg-black border border-brand-primary/30 rounded-2xl space-y-3.5 shadow-lg">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-primary flex items-center gap-1">
                          <CreditCard size={14} /> Send Payment
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/20 font-bold">
                          Draft
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-semibold">To</span>
                          <span className="text-white font-bold truncate block">
                            {msg.draft.recipientName || msg.draft.recipient || 'Recipient'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-semibold">Amount</span>
                          <span className="text-brand-primary font-extrabold text-sm">
                            {msg.draft.amount} {msg.draft.currency || 'HSCT'}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-neutral-400 block text-[10px] uppercase font-semibold">Address</span>
                          <span className="text-neutral-300 font-mono text-[11px] truncate block bg-white/5 px-2 py-1 rounded">
                            {msg.draft.recipientAddress || msg.draft.recipient || '0x...'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-semibold">Asset</span>
                          <span className="text-white font-semibold">{msg.draft.currency || 'HSCT'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-semibold">Network</span>
                          <span className="text-white font-semibold">
                            {msg.draft.preferredRoute === 'INTERNAL' ? 'SecureChain PoA' : 'Ethereum'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => openVerificationForDraft(msg.draft)}
                        className="w-full py-3 bg-brand-primary hover:bg-brand-pale text-neutral-950 font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 min-h-[44px]"
                      >
                        <Lock size={14} /> Review Payment
                      </button>
                    </div>
                  )}

                  {/* PAYMENT REQUEST CARD */}
                  {msg.paymentRequest && (
                    <div className="mt-4 p-4 bg-black border border-brand-primary/30 rounded-2xl space-y-4">
                      {msg.paymentRequest.qrDataUrl && (
                        <div className="flex flex-col items-center p-3 bg-white rounded-xl shadow-md">
                          <img
                            src={msg.paymentRequest.qrDataUrl}
                            alt="Payment Request QR Code"
                            className="w-40 h-40 object-contain"
                          />
                          <span className="text-[10px] text-neutral-600 font-mono mt-1 font-bold">
                            Scan to Pay Request
                          </span>
                        </div>
                      )}

                      {msg.paymentRequest.shareableLink && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-neutral-400 uppercase font-semibold block">
                            Shareable Payment Link
                          </span>
                          <div className="flex items-center gap-2 bg-[#121212] p-2 rounded-xl border border-white/10 text-xs font-mono">
                            <span className="truncate text-brand-primary flex-1">
                              {`${typeof window !== 'undefined' ? window.location.origin : ''}${
                                msg.paymentRequest.shareableLink
                              }`}
                            </span>
                            <button
                              onClick={() => copyShareableLink(msg.paymentRequest.shareableLink)}
                              className="px-2.5 py-1 bg-brand-primary text-neutral-950 font-bold text-[11px] rounded-lg hover:bg-brand-pale transition-colors flex items-center gap-1"
                            >
                              {copiedLink === msg.paymentRequest.shareableLink ? (
                                <Check size={12} />
                              ) : (
                                <Copy size={12} />
                              )}
                              {copiedLink === msg.paymentRequest.shareableLink ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      )}

                      {msg.paymentRequest.status === 'PENDING' && (
                        <button
                          onClick={() => openVerificationForRequest(msg.paymentRequest)}
                          className="w-full py-3 bg-brand-primary hover:bg-brand-pale text-neutral-950 font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 min-h-[44px]"
                        >
                          Review Payment →
                        </button>
                      )}
                    </div>
                  )}

                  {/* Timestamp footer */}
                  <div
                    className={`mt-2 text-[10px] ${
                      msg.sender === 'user' ? 'text-neutral-800 font-semibold' : 'text-neutral-500'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0">
                  <Bot className="h-4 w-4 animate-pulse" />
                </div>
                <div className="bg-[#121212] border border-white/10 rounded-2xl rounded-bl-none p-3.5 text-xs text-neutral-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand-primary animate-pulse" />
                  Processing payment intent & resolving recipient parameters...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Suggestion Chips (Prompt Section 13) */}
          <div className="px-4 py-2 border-t border-white/10 bg-[#121212]/50 flex gap-2 overflow-x-auto no-scrollbar">
            {(
              messages[messages.length - 1]?.quickReplies || [
                'Send money',
                'Request money',
                'Scan QR',
                'Check wallet',
                'Analyze payment',
              ]
            ).map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-xs font-semibold transition-all whitespace-nowrap min-h-[34px]"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 sm:p-4 border-t border-white/10 bg-black">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type command (e.g. 'Pay ₹500 to Rahul', 'Request 50 HSCT', 'Send $10 to 0x12...')"
                className="flex-1 bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-primary/50 min-h-[44px]"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isProcessing}
                className="px-4 sm:px-5 py-3 rounded-xl bg-brand-primary hover:bg-brand-pale disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 font-extrabold flex items-center gap-2 transition-all min-h-[44px]"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Context & Quick Tools Panel */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Prepared Draft Card */}
          <div className="p-5 rounded-3xl bg-[#0a0a0a] border border-white/10 backdrop-blur-md relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-brand-primary" />
                <h3 className="font-bold text-white text-sm">Active Draft</h3>
              </div>

              {activeDraft && draftCountdown !== null && (
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono">
                  <Clock size={12} /> {draftCountdown}s
                </div>
              )}
            </div>

            {activeDraft && activeDraft.status === 'DRAFT' ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-2xl bg-black border border-white/10 space-y-2.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-neutral-400">Total Amount</span>
                    <span className="text-2xl font-extrabold text-brand-primary">
                      {activeDraft.amount} <span className="text-xs text-white">{activeDraft.currency}</span>
                    </span>
                  </div>

                  <div className="flex justify-between text-xs pt-2 border-t border-white/5">
                    <span className="text-neutral-400">Recipient</span>
                    <span className="text-white font-medium truncate max-w-[160px]">
                      {activeDraft.recipient}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => openVerificationForDraft(activeDraft)}
                  className="w-full py-3 bg-brand-primary hover:bg-brand-pale text-neutral-950 font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Lock size={14} /> Review Payment
                </button>
              </div>
            ) : (
              <div className="mt-6 py-8 text-center text-xs text-neutral-500 space-y-2">
                <ShieldCheck className="h-8 w-8 text-neutral-600 mx-auto" />
                <p className="font-medium text-neutral-400">No active payment draft</p>
                <p className="text-[11px] text-neutral-500">
                  Ask Copilot to send or request money to prepare a transaction.
                </p>
              </div>
            )}
          </div>

          {/* Quick Payment Action Cards */}
          <div className="p-5 rounded-3xl bg-[#0a0a0a] border border-white/10 space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Zap size={16} className="text-brand-primary" /> Quick Payment Tools
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSendMessage('Request ₹500')}
                className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-left space-y-1 transition-all min-h-[70px]"
              >
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <QrCode size={14} className="text-brand-primary" /> Request Money
                </div>
                <p className="text-[11px] text-neutral-400">Create request QR & link</p>
              </button>

              <button
                onClick={() => setIsQRScannerOpen(true)}
                className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-left space-y-1 transition-all min-h-[70px]"
              >
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Camera size={14} className="text-brand-primary" /> Scan QR
                </div>
                <p className="text-[11px] text-neutral-400">Camera or screenshot</p>
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
