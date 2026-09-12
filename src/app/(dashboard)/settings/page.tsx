'use client';

import { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Wallet,
  Cpu,
  Sliders,
  Download,
  Bot,
  HelpCircle,
  ChevronRight,
  Copy,
  Check,
  Lock,
  Mail,
  ExternalLink,
  ShieldCheck,
  Key,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';
import { auth, db } from '@/lib/firebase/client';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { AISettings } from '@/components/trading-ai/AISettings';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [theme, setTheme] = useState('dark');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const profileUser = useAuthStore((state) => state.user);

  const address = useWalletStore((state) => state.address);
  const publicKey = useWalletStore((state) => state.publicKey);
  const encryptedPrivateKey = useWalletStore((state) => state.encryptedPrivateKey);
  const keyFingerprint = useWalletStore((state) => state.keyFingerprint);
  const algorithm = useWalletStore((state) => state.algorithm);
  const keyGeneratedAt = useWalletStore((state) => state.keyGeneratedAt);
  const walletVersion = useWalletStore((state) => state.walletVersion);
  const identityStatus = useWalletStore((state) => state.identityStatus);
  const initializationErrorCode = useWalletStore((state) => state.initializationErrorCode);
  const initializationErrorMessage = useWalletStore((state) => state.initializationErrorMessage);
  const initializeWallet = useWalletStore((state) => state.initializeWallet);
  const [isRetryingWallet, setIsRetryingWallet] = useState(false);

  const updateUser = useAuthStore((state) => state.updateUser);
  const [displayNameInput, setDisplayNameInput] = useState(profileUser?.name || profileUser?.displayName || '');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameUpdateSuccess, setNameUpdateSuccess] = useState<string | null>(null);
  const [nameUpdateError, setNameUpdateError] = useState<string | null>(null);

  useEffect(() => {
    if (profileUser?.name && !displayNameInput) {
      setDisplayNameInput(profileUser.name);
    }
  }, [profileUser?.name]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayNameInput.trim();
    if (!cleanName || cleanName.length < 2) {
      setNameUpdateError('Name must be at least 2 characters.');
      return;
    }

    setIsUpdatingName(true);
    setNameUpdateError(null);
    setNameUpdateSuccess(null);

    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await updateProfile(currentUser, { displayName: cleanName });
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, { name: cleanName, displayName: cleanName }, { merge: true });
      }

      updateUser({ name: cleanName });
      setNameUpdateSuccess('Display name updated successfully!');
      setTimeout(() => setNameUpdateSuccess(null), 4000);
    } catch (err: any) {
      console.error('Failed to update name:', err);
      setNameUpdateError(err.message || 'Failed to update name');
    } finally {
      setIsUpdatingName(false);
    }
  };

  const profileUsername = profileUser?.username || profileUser?.name || 'SecureChain User';
  const profileContact = profileUser?.email || profileUser?.phoneNumber || 'No contact specified';

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const retryWalletInitialization = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || isRetryingWallet) return;
    setIsRetryingWallet(true);
    try {
      await initializeWallet(uid);
    } catch (error) {
      console.error('[Profile] Wallet retry failed:', error);
    } finally {
      setIsRetryingWallet(false);
    }
  };

  const handleExportData = () => {
    const exportData = {
      username: profileUsername,
      contact: profileContact,
      address,
      publicKey,
      keyFingerprint,
      algorithm,
      walletVersion,
      keyGeneratedAt,
      exportedAt: new Date().toISOString(),
      platform: 'SecureChain Pay Web3 Financial System',
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securechain-account-${profileUsername}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User size={18} /> },
    { id: 'security', label: 'Security', icon: <Shield size={18} /> },
    { id: 'wallet', label: 'Wallet', icon: <Wallet size={18} /> },
    { id: 'blockchain', label: 'Blockchain', icon: <Cpu size={18} /> },
    { id: 'preferences', label: 'Preferences', icon: <Sliders size={18} /> },
    { id: 'data-export', label: 'Data Export', icon: <Download size={18} /> },
    { id: 'trading-ai', label: 'Trading AI', icon: <Bot size={18} /> },
    { id: 'help', label: 'Help & Support', icon: <HelpCircle size={18} /> },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-32 md:pb-12 text-white">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">
          Settings & Account
        </h1>
        <p className="text-neutral-400 text-xs sm:text-sm">
          Manage your decentralized identity, non-custodial cryptographic keys, and system preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 sm:gap-8">
        {/* Navigation Sidebar: Horizontal scroll on mobile, vertical stack on desktop */}
        <div className="md:col-span-1 flex md:flex-col overflow-x-auto no-scrollbar md:overflow-visible gap-1.5 pb-2 md:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all flex-shrink-0 md:w-full min-h-[44px] ${
                activeTab === tab.id
                  ? 'bg-brand-primary text-neutral-950 font-extrabold shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 text-xs sm:text-sm whitespace-nowrap">
                {tab.icon}
                <span>{tab.label}</span>
              </div>
              <ChevronRight
                size={16}
                className={`hidden md:block ${activeTab === tab.id ? 'opacity-100' : 'opacity-0'}`}
              />
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 bg-[#0a0a0a] border border-white/10 rounded-3xl p-5 sm:p-7 md:p-8 backdrop-blur-xl relative overflow-hidden shadow-xl">
          {/* Ambient Glow */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />

          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white">Profile Identity</h2>
                  <p className="text-xs sm:text-sm text-neutral-400">
                    Decentralized account credentials and profile details.
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1.5 w-fit">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Account Active
                </span>
              </div>

              {/* Identity Header Card */}
              <div className="p-5 bg-[#121212] border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border-2 border-brand-primary/40 flex items-center justify-center text-brand-primary text-2xl font-black shrink-0">
                  {profileUsername.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-center sm:text-left space-y-1 min-w-0">
                  <h3 className="text-lg font-bold text-white truncate">{profileUsername}</h3>
                  <p className="text-xs text-neutral-400 font-mono truncate">{profileContact}</p>
                  <div className="flex flex-wrap gap-2 pt-2 justify-center sm:justify-start">
                    <span className="text-[11px] px-2.5 py-1 bg-black border border-white/10 rounded-lg text-neutral-300 font-mono">
                      UID: {profileUser?.id ? `${profileUser.id.substring(0, 10)}...` : 'N/A'}
                    </span>
                    <span className="text-[11px] px-2.5 py-1 bg-black border border-brand-primary/30 rounded-lg text-brand-primary font-bold">
                      Tier: {profileUser?.accountTier || 'Standard Non-Custodial'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Full Name Edit Form */}
              <form onSubmit={handleUpdateName} className="p-5 bg-[#121212] border border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Full Name / Display Name
                  </label>
                  {nameUpdateSuccess && (
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 animate-in fade-in">
                      <Check size={14} /> {nameUpdateSuccess}
                    </span>
                  )}
                  {nameUpdateError && (
                    <span className="text-xs font-semibold text-rose-400 flex items-center gap-1 animate-in fade-in">
                      <AlertCircle size={14} /> {nameUpdateError}
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="Enter your display name"
                    className="flex-1 px-4 py-3 bg-black border border-white/15 rounded-xl text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-brand-primary/50 transition-colors min-h-[44px]"
                  />
                  <button
                    type="submit"
                    disabled={isUpdatingName || !displayNameInput.trim() || displayNameInput.trim() === profileUser?.name}
                    className={`px-5 py-3 rounded-xl text-xs font-extrabold transition-all shadow-md min-h-[44px] flex items-center justify-center gap-2 ${
                      isUpdatingName || !displayNameInput.trim() || displayNameInput.trim() === profileUser?.name
                        ? 'bg-white/10 text-neutral-500 cursor-not-allowed'
                        : 'bg-brand-primary hover:bg-brand-pale text-neutral-950 active:scale-95'
                    }`}
                  >
                    {isUpdatingName ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>Save Name</span>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500">
                  This name is displayed in greeting headers, payment receipts, and invoices.
                </p>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Registered Username
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profileUsername}
                    className="w-full px-3.5 py-2.5 bg-black border border-white/10 rounded-xl text-xs sm:text-sm text-neutral-200 font-medium opacity-80 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-neutral-500">Unique handle for P2P transfers.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Linked Contact
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profileContact}
                    className="w-full px-3.5 py-2.5 bg-black border border-white/10 rounded-xl text-xs sm:text-sm text-neutral-200 font-mono opacity-80 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-neutral-500">Email or phone number for authentication.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SECURITY & PRIVATE KEYS (PROMPT SECTIONS 16 & 17) */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="pb-4 border-b border-white/10">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Security & Cryptographic Keys</h2>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Protected non-custodial key storage, encryption details, and authentication safeguards.
                </p>
              </div>

              {/* Private Key Security Notice */}
              <div className="p-5 bg-[#121212] border border-brand-primary/25 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-brand-primary font-bold text-sm">
                    <Key size={18} />
                    <span>Private Key Protection</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    AES-256-GCM Encrypted
                  </span>
                </div>
                <div className="p-3 bg-black border border-white/10 rounded-xl">
                  <div className="text-xs font-mono text-neutral-400 flex items-center justify-between">
                    <span>Private Key:</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Lock size={12} /> Protected — accessed in-memory only for signing
                    </span>
                  </div>
                </div>
                <p className="text-xs text-neutral-400">
                  Your private key is stored in your secure non-custodial credential vault. It is never exposed in plaintext
                  or transmitted across the network.
                </p>
              </div>

              {/* Security Features */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-[#121212] border border-white/10 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Non-Custodial Architecture</h4>
                      <p className="text-xs text-neutral-400">Only your browser holds signing authority</p>
                    </div>
                  </div>
                  <span className="text-xs text-brand-primary font-semibold">Active</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#121212] border border-white/10 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <Lock size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Mandatory Payment Verification</h4>
                      <p className="text-xs text-neutral-400">Every transaction requires explicit visual review</p>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold">Enforced</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WALLET */}
          {activeTab === 'wallet' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white">Wallet Identity</h2>
                  <p className="text-xs sm:text-sm text-neutral-400">
                    Your non-custodial public credentials — safe to share.
                  </p>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 w-fit border ${
                  address
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${address ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                  {address ? 'Wallet Active' : 'Wallet Initializing'}
                </span>
              </div>

              <div className="space-y-5">

                {/* ── Wallet Address Card ── */}
                <div className="p-5 bg-[#121212] border border-brand-primary/20 rounded-2xl space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-xl bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center">
                      <Wallet size={16} className="text-brand-primary" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-white uppercase tracking-wider">Wallet Address</span>
                      <p className="text-[10px] text-neutral-500">Your public on-chain identifier — safe to share for receiving payments</p>
                    </div>
                  </div>

                  {address ? (
                    <>
                      {/* Full address scrollable box */}
                      <div className="bg-black border border-white/10 rounded-xl p-3 overflow-x-auto">
                        <p className="font-mono text-sm text-brand-primary whitespace-nowrap tracking-wide select-all">
                          {address}
                        </p>
                      </div>
                      {/* Short preview + copy button */}
                      <div className="flex items-center gap-2">
                        <span className="flex-1 font-mono text-xs text-neutral-400 bg-white/5 border border-white/5 px-3 py-2 rounded-lg truncate">
                          {address.substring(0, 10)}...{address.substring(address.length - 8)}
                        </span>
                        <button
                          onClick={() => copyToClipboard('addr', address)}
                          className="px-4 py-2 bg-brand-primary hover:bg-brand-pale text-neutral-950 font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 min-h-[38px] shrink-0"
                        >
                          {copiedKey === 'addr' ? <Check size={13} /> : <Copy size={13} />}
                          {copiedKey === 'addr' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="bg-black border border-white/10 rounded-xl p-4 text-center text-xs text-neutral-500 animate-pulse">
                      Generating wallet address...
                    </div>
                  )}
                </div>

                {/* ── Public Key Card ── */}
                <div className="p-5 bg-[#121212] border border-purple-500/20 rounded-2xl space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                      <Key size={16} className="text-purple-400" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-white uppercase tracking-wider">Public Key</span>
                      <p className="text-[10px] text-neutral-500">ECDSA/secp256k1 — used to verify your transaction signatures</p>
                    </div>
                  </div>

                  {(publicKey || address) ? (
                    <>
                      {/* Full public key scrollable box */}
                      <div className="bg-black border border-white/10 rounded-xl p-3 overflow-x-auto max-h-24 overflow-y-auto">
                        <p className="font-mono text-xs text-purple-300 whitespace-pre-wrap break-all select-all leading-relaxed">
                          {publicKey || address}
                        </p>
                      </div>
                      {/* Short preview + copy button */}
                      <div className="flex items-center gap-2">
                        <span className="flex-1 font-mono text-xs text-neutral-400 bg-white/5 border border-white/5 px-3 py-2 rounded-lg truncate">
                          {(publicKey || address || '').substring(0, 14)}...{(publicKey || address || '').substring((publicKey || address || '').length - 8)}
                        </span>
                        <button
                          onClick={() => copyToClipboard('pubkey', publicKey || address || '')}
                          className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 min-h-[38px] shrink-0"
                        >
                          {copiedKey === 'pubkey' ? <Check size={13} /> : <Copy size={13} />}
                          {copiedKey === 'pubkey' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="bg-black border border-white/10 rounded-xl p-4 text-center text-xs text-neutral-500 animate-pulse">
                      Generating key pair...
                    </div>
                  )}
                </div>

                {/* ── Key Metadata Grid ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 bg-[#121212] border border-white/10 rounded-xl space-y-1">
                    <span className="text-neutral-500 uppercase font-semibold text-[10px] block">Algorithm</span>
                    <span className="font-mono font-bold text-white text-[11px]">{algorithm || 'ECDSA/secp256k1'}</span>
                  </div>
                  <div className="p-3.5 bg-[#121212] border border-white/10 rounded-xl space-y-1">
                    <span className="text-neutral-500 uppercase font-semibold text-[10px] block">Key Version</span>
                    <span className="font-mono font-bold text-white text-[11px]">v{walletVersion || '1.0'}</span>
                  </div>
                  <div className="p-3.5 bg-[#121212] border border-white/10 rounded-xl space-y-1">
                    <span className="text-neutral-500 uppercase font-semibold text-[10px] block">Fingerprint</span>
                    <span className="font-mono font-bold text-brand-primary text-[11px] truncate block">{keyFingerprint ? `${keyFingerprint.substring(0, 12)}...` : 'Verified'}</span>
                  </div>
                  {keyGeneratedAt && (
                    <div className="p-3.5 bg-[#121212] border border-white/10 rounded-xl space-y-1 col-span-2 sm:col-span-3">
                      <span className="text-neutral-500 uppercase font-semibold text-[10px] block">Key Generated</span>
                      <span className="font-mono font-bold text-neutral-300 text-[11px]">
                        {new Date(keyGeneratedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Security Note ── */}
                <div className="flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl text-xs text-neutral-400">
                  <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    Your <span className="text-white font-semibold">private key is never shown here</span> — it stays AES-256-GCM encrypted inside your secure vault and is only accessed in-memory during transaction signing.
                  </p>
                </div>

                {identityStatus === 'error' && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs flex items-center justify-between gap-3">
                    <span className="text-amber-200">
                      Wallet cloud verification: {initializationErrorMessage || 'Local initialization only'}
                    </span>
                    <button
                      onClick={retryWalletInitialization}
                      disabled={isRetryingWallet}
                      className="px-3 py-1.5 bg-amber-500 text-neutral-950 font-bold rounded-lg shrink-0"
                    >
                      {isRetryingWallet ? 'Retrying...' : 'Retry'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BLOCKCHAIN */}
          {activeTab === 'blockchain' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="pb-4 border-b border-white/10">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Blockchain Specifications</h2>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Consensus parameters, cryptographic primitives, and node telemetry.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-[#121212] border border-white/10 rounded-2xl space-y-1">
                  <span className="text-neutral-400 font-semibold block uppercase">Consensus Mechanism</span>
                  <span className="text-sm font-bold text-white">Proof of Authority (PoA)</span>
                  <p className="text-neutral-500 text-[11px]">Instant block time with validator finality.</p>
                </div>

                <div className="p-4 bg-[#121212] border border-white/10 rounded-2xl space-y-1">
                  <span className="text-neutral-400 font-semibold block uppercase">Network Gas Fee</span>
                  <span className="text-sm font-bold text-brand-primary">0% (Gasless)</span>
                  <p className="text-neutral-500 text-[11px]">Zero network surcharge for P2P transfers.</p>
                </div>

                <div className="p-4 bg-[#121212] border border-white/10 rounded-2xl space-y-1">
                  <span className="text-neutral-400 font-semibold block uppercase">Hashing Algorithm</span>
                  <span className="text-sm font-bold text-white">SHA-256 + Merkle Tree</span>
                  <p className="text-neutral-500 text-[11px]">Cryptographic tamper-proofing on every block.</p>
                </div>

                <div className="p-4 bg-[#121212] border border-white/10 rounded-2xl space-y-1">
                  <span className="text-neutral-400 font-semibold block uppercase">Key Fingerprint</span>
                  <span className="text-xs font-mono font-bold text-brand-primary truncate block">
                    {keyFingerprint || 'SHA256:SECURECHAIN'}
                  </span>
                  <p className="text-neutral-500 text-[11px]">Unique cryptographic fingerprint of your key pair.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PREFERENCES */}
          {activeTab === 'preferences' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="pb-4 border-b border-white/10">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">App Preferences</h2>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Customization options and platform currency defaults.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-[#121212] border border-white/10 rounded-2xl">
                  <div>
                    <h4 className="font-bold text-white text-sm">Theme Mode</h4>
                    <p className="text-xs text-neutral-400">Select visual display style</p>
                  </div>
                  <div className="flex bg-black p-1 rounded-xl border border-white/10">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        theme === 'dark'
                          ? 'bg-brand-primary text-neutral-950 shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Dark
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        theme === 'light'
                          ? 'bg-brand-primary text-neutral-950 shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Light
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl flex items-center gap-3">
                  <Coins size={20} className="text-brand-primary shrink-0" />
                  <div className="text-xs text-neutral-300">
                    <p className="font-bold text-white">Default Settlement Currency: HSCT</p>
                    <p className="text-neutral-400">
                      Portfolio calculations are denominated in HSCT (₹1 INR parity) with instant multi-currency
                      conversion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: DATA EXPORT (PROMPT SECTION 17) */}
          {activeTab === 'data-export' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="pb-4 border-b border-white/10">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Data Export</h2>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Export your non-custodial cryptographic credentials and profile records.
                </p>
              </div>

              <div className="p-5 bg-[#121212] border border-white/10 rounded-2xl space-y-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">Download Profile & Public Key Bundle</h4>
                  <p className="text-xs text-neutral-400">
                    Saves a JSON file containing your decentralized username, linked contact, public wallet address, and
                    key fingerprint.
                  </p>
                </div>

                <button
                  onClick={handleExportData}
                  className="px-5 py-3 bg-brand-primary hover:bg-brand-pale text-neutral-950 font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 min-h-[44px]"
                >
                  <Download size={16} /> Export Profile JSON
                </button>
              </div>
            </div>
          )}

          {/* TAB 7: TRADING AI */}
          {activeTab === 'trading-ai' && <AISettings />}

          {/* TAB 8: HELP & SUPPORT */}
          {activeTab === 'help' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="pb-4 border-b border-white/10">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Help & Support</h2>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Get assistance with payments, key management, or blockchain settlement.
                </p>
              </div>

              <div className="p-5 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl space-y-3">
                <h4 className="font-bold text-white text-sm">Direct Support Channel</h4>
                <p className="text-xs text-neutral-300">
                  Contact our engineering and security team for assistance with non-custodial account restoration or
                  transaction validation queries.
                </p>
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <Mail size={16} className="text-brand-primary" />
                  <a href="mailto:support@securechain.pay" className="text-brand-primary font-bold hover:underline">
                    support@securechain.pay
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
