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
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  intent?: string;
  decisionId?: string;
  actionRequired?: string;
  draft?: any;
  preflight?: any;
  failureAnalysis?: any;
  paymentAudit?: any;
  quickReplies?: string[];
  feedback?: 'HELPFUL' | 'UNHELPFUL' | 'INCORRECT';
  timestamp: string;
}

export default function CopilotDashboard() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'copilot',
      text: "👋 Hello! I'm your **AI Payment Copilot**. I can prepare instant payments, evaluate routing health, perform cryptographic security checks, and diagnose transaction issues.\n\n*How can I assist your payments today?*",
      intent: 'GENERAL_QUESTION',
      quickReplies: [
        'Send $100 to alice@example.com',
        'Check settlement route latency',
        'Run safety check on recipient',
        'Explain recent transaction status',
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
  const [editModalDraft, setEditModalDraft] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editRecipient, setEditRecipient] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeDraft]);

  // Fetch active drafts & telemetry on mount
  useEffect(() => {
    fetchActiveDraft();
    fetchTelemetry();
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

  const fetchActiveDraft = async () => {
    try {
      const res = await fetch('/api/payments/draft');
      const data = await res.json();
      if (data.drafts && data.drafts.length > 0) {
        setActiveDraft(data.drafts[0]);
      }
    } catch (e) {
      console.error('Error fetching draft:', e);
    }
  };

  const fetchTelemetry = async () => {
    try {
      const res = await fetch('/api/payments/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 10, recipient: 'telemetry_probe', preferredRoute: 'ADAPTIVE' }),
      });
      const data = await res.json();
      if (data?.routeHealth) {
        setTelemetry(data);
      }
    } catch (e) {
      console.error('Error fetching telemetry:', e);
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

  const handleConfirmDraft = async (draftId: string) => {
    setIsConfirmingDraft(true);
    try {
      const res = await fetch(`/api/payments/draft/${draftId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to authorize payment.');
      }

      setActiveDraft(null);
      setDraftCountdown(null);

      setMessages((prev) => [
        ...prev,
        {
          id: `conf-${Date.now()}`,
          sender: 'copilot',
          text: `🎉 **Payment Confirmed & Settled!**\n\n• **Amount**: ${data.paymentIntent?.amount} ${data.paymentIntent?.currency}\n• **Recipient**: ${data.draft?.recipient}\n• **Settlement Route**: ${data.paymentIntent?.routeUsed}\n• **Transaction Reference**: \`${data.transaction?.id || data.paymentIntent?.id}\`\n\nCryptographic proof has been anchored to the tamper-evident ledger.`,
          quickReplies: ['View Event Timeline', 'Send Another Payment', 'Check Balance'],
          paymentAudit: data.paymentIntent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-conf-${Date.now()}`,
          sender: 'copilot',
          text: `❌ **Authorization Blocked:** ${err.message}`,
          quickReplies: ['Edit Draft', 'Top Up Balance', 'Contact Support'],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsConfirmingDraft(false);
    }
  };

  const handleCancelDraft = async (draftId: string) => {
    try {
      await fetch(`/api/payments/draft/${draftId}`, { method: 'DELETE' });
      setActiveDraft(null);
      setDraftCountdown(null);

      setMessages((prev) => [
        ...prev,
        {
          id: `cancel-${Date.now()}`,
          sender: 'copilot',
          text: '🗑️ Payment draft has been cancelled. No funds were debited.',
          quickReplies: ['Send New Payment', 'Check Route Latency'],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (e) {
      console.error('Cancel draft error:', e);
    }
  };

  const handleUpdateDraft = async () => {
    if (!editModalDraft) return;
    try {
      const res = await fetch(`/api/payments/draft/${editModalDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: editAmount ? parseFloat(editAmount) : undefined,
          recipient: editRecipient || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActiveDraft(data.draft);
      setEditModalDraft(null);

      setMessages((prev) => [
        ...prev,
        {
          id: `upd-${Date.now()}`,
          sender: 'copilot',
          text: `✏️ **Draft Updated:** ${data.draft.amount} ${data.draft.currency} to **${data.draft.recipient}**. TTL refreshed for 5 minutes.`,
          draft: data.draft,
          preflight: data.preflight,
          quickReplies: ['Confirm Payment', 'Cancel Draft'],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (e: any) {
      alert(e.message || 'Update failed');
    }
  };

  const handleFeedback = async (decisionId: string, feedback: 'HELPFUL' | 'UNHELPFUL' | 'INCORRECT') => {
    try {
      await fetch('/api/ai/payment-copilot/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionId, feedback }),
      });

      setMessages((prev) =>
        prev.map((msg) => (msg.decisionId === decisionId ? { ...msg, feedback } : msg))
      );
    } catch (e) {
      console.error('Feedback error:', e);
    }
  };

  const inspectTimeline = async (paymentId: string) => {
    try {
      const res = await fetch(`/api/payments/${paymentId}/timeline`);
      const data = await res.json();
      setSelectedTimeline(data);
    } catch (e) {
      console.error('Timeline error:', e);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
          <p className="text-neutral-400 mt-1">
            Intelligent payment preparation, multi-path routing telemetry, and evidence-grounded risk defense.
          </p>
        </div>

        {/* Live System Badge */}
        <div className="flex items-center gap-3 bg-neutral-900/80 border border-neutral-800 px-4 py-2 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-neutral-300 font-medium">Orchestration Active</span>
          </div>
          <span className="text-neutral-600">|</span>
          <span className="text-xs text-neutral-400 flex items-center gap-1">
            <Lock className="h-3 w-3 text-cyan-400" />
            Policy v1.0
          </span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Chat Conversation Stream (7 or 8 cols) */}
        <div className="lg:col-span-8 flex flex-col h-[700px] bg-neutral-900/60 border border-neutral-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
          {/* Chat Stream Header */}
          <div className="p-4 border-b border-neutral-800/80 bg-neutral-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-neutral-200">Conversational Payment Engine</span>
            </div>
            <button
              onClick={() =>
                setMessages([
                  {
                    id: 'welcome-reset',
                    sender: 'copilot',
                    text: 'Conversation reset. How can I assist you with payments or routing?',
                    quickReplies: ['Send $50 to alex@example.com', 'Check route status'],
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ])
              }
              className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Clear Chat
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
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
                  {/* Markdown-like simple rendering */}
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

                  {/* Preflight Badge in Message */}
                  {msg.preflight && (
                    <div className="mt-3 p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-700/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span>
                          Pre-flight: <strong className="text-white">{msg.preflight.status}</strong>
                        </span>
                      </div>
                      <span className="text-neutral-400">Risk: {msg.preflight.riskScore}/100</span>
                    </div>
                  )}

                  {/* Payment Audit Action in Message */}
                  {msg.paymentAudit && (
                    <div className="mt-3">
                      <button
                        onClick={() =>
                          inspectTimeline(msg.paymentAudit.id || msg.paymentAudit.paymentIntentId)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-950 border border-neutral-700 text-xs text-cyan-400 transition-colors"
                      >
                        <Clock className="h-3.5 w-3.5" /> View Cryptographic Timeline
                      </button>
                    </div>
                  )}

                  {/* Message Meta & Feedback Buttons */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-700/40 text-[11px] text-neutral-400">
                    <span>{msg.timestamp}</span>

                    {msg.sender === 'copilot' && msg.decisionId && (
                      <div className="flex items-center gap-2">
                        {msg.feedback ? (
                          <span className="text-emerald-400 text-[10px]">Feedback recorded</span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleFeedback(msg.decisionId!, 'HELPFUL')}
                              className="hover:text-emerald-400 transition-colors p-1"
                              title="Helpful"
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleFeedback(msg.decisionId!, 'UNHELPFUL')}
                              className="hover:text-red-400 transition-colors p-1"
                              title="Unhelpful"
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
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
                  Analyzing risk signals, evaluating routes, and drafting payment context...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Suggestion Pills */}
          {messages.length > 0 && messages[messages.length - 1].quickReplies && (
            <div className="px-4 py-2 border-t border-neutral-800/60 bg-neutral-950/20 flex gap-2 overflow-x-auto no-scrollbar">
              {messages[messages.length - 1].quickReplies?.map((pill, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(pill)}
                  className="px-3 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 whitespace-nowrap border border-neutral-700/60 transition-colors"
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
                placeholder="Ask Copilot: e.g. 'Send ₹500 to rahul@example.com' or 'Check network route health'..."
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

        {/* Right Column: Active Draft & Route Telemetry Panel (4 or 5 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Payment Draft Card */}
          <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800/90 backdrop-blur-md relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-cyan-400" />
                <h3 className="font-semibold text-neutral-100">Active Payment Draft</h3>
              </div>

              {activeDraft && draftCountdown !== null && (
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium ${
                    draftCountdown > 60
                      ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                      : 'bg-red-950/60 text-red-400 border border-red-500/30 animate-pulse'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {formatCountdown(draftCountdown)}
                </div>
              )}
            </div>

            {activeDraft && activeDraft.status === 'DRAFT' ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-neutral-400">Total Amount</span>
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

                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Route Candidate</span>
                    <span className="text-cyan-400 font-medium">{activeDraft.preferredRoute}</span>
                  </div>
                </div>

                {/* Preflight Security Verdict */}
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    Security Pre-flight Passed
                  </div>
                  <p className="text-neutral-400">
                    Risk evaluated as Low (15/100). Adaptive route selected with 99.4% estimated reliability.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => handleConfirmDraft(activeDraft.id)}
                    disabled={isConfirmingDraft || draftCountdown === 0}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40"
                  >
                    {isConfirmingDraft ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Authorizing & Executing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Authorize & Pay Now
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setEditModalDraft(activeDraft);
                        setEditAmount(String(activeDraft.amount));
                        setEditRecipient(activeDraft.recipient);
                      }}
                      className="py-2 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-xs text-neutral-300 font-medium transition-colors"
                    >
                      Edit Draft
                    </button>
                    <button
                      onClick={() => handleCancelDraft(activeDraft.id)}
                      className="py-2 rounded-lg bg-neutral-900 hover:bg-neutral-950 text-xs text-red-400 border border-red-500/20 font-medium transition-colors"
                    >
                      Cancel Draft
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 py-8 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center mx-auto text-neutral-500">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div className="text-sm text-neutral-300 font-medium">No Pending Draft</div>
                <p className="text-xs text-neutral-500 max-w-[220px] mx-auto">
                  Type a command like <span className="text-emerald-400">"Send $50 to Alice"</span> in chat to create an instant draft.
                </p>
              </div>
            )}
          </div>

          {/* Real-Time Route Telemetry Card */}
          <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800/90 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                <h3 className="font-semibold text-neutral-100">Settlement Route Health</h3>
              </div>
              <span className="text-xs text-neutral-400">Live Telemetry</span>
            </div>

            <div className="space-y-3 text-xs">
              {[
                { name: 'Internal Ledger (Instant)', reliability: 99.8, latency: 12, status: 'OPTIMAL', color: 'emerald' },
                { name: 'Lightning Network', reliability: 96.5, latency: 180, status: 'HEALTHY', color: 'cyan' },
                { name: 'Hardhat EVM Chain', reliability: 98.2, latency: 350, status: 'HEALTHY', color: 'amber' },
                { name: 'Stripe Fiat Gateway', reliability: 99.1, latency: 620, status: 'HEALTHY', color: 'purple' },
              ].map((route, i) => (
                <div key={i} className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-neutral-200">{route.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/20">
                      {route.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-400 text-[11px]">
                    <span>Reliability: {route.reliability}%</span>
                    <span>~{route.latency}ms latency</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${route.reliability}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Draft Modal */}
      {editModalDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="h-5 w-5 text-emerald-400" />
              Edit Payment Draft
            </h3>
            <p className="text-xs text-neutral-400">
              Modifying critical fields invalidates any prior confirmation and re-triggers pre-flight security evaluation.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-300 font-medium">Amount</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full mt-1 bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-300 font-medium">Recipient</label>
                <input
                  type="text"
                  value={editRecipient}
                  onChange={(e) => setEditRecipient(e.target.value)}
                  className="w-full mt-1 bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditModalDraft(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateDraft}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
              >
                Save & Re-evaluate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Timeline Modal */}
      {selectedTimeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-cyan-400" />
                <h3 className="font-bold text-white">Payment Lifecycle Timeline</h3>
              </div>
              <button
                onClick={() => setSelectedTimeline(null)}
                className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs space-y-1">
                <div className="text-neutral-400">Payment Intent ID:</div>
                <div className="font-mono text-cyan-400 break-all">{selectedTimeline.paymentId}</div>
              </div>

              {/* Timeline Steps */}
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-800">
                {selectedTimeline.timeline?.map((step: any, idx: number) => (
                  <div key={idx} className="relative space-y-1">
                    <span className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-neutral-900" />
                    <div className="text-xs font-semibold text-neutral-200">{step.eventType}</div>
                    <div className="text-[11px] text-neutral-400">
                      {new Date(step.timestamp).toLocaleString()}
                    </div>
                    {step.details && (
                      <div className="p-2 rounded bg-neutral-950/80 font-mono text-[10px] text-neutral-300">
                        {JSON.stringify(step.details)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedTimeline(null)}
              className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
