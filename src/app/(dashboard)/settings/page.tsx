'use client';

import { useState, useEffect } from 'react';
import { User, Bell, Lock, HelpCircle, Info, ChevronRight, Mail, ExternalLink, Moon, Sun, CreditCard, Key, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [theme, setTheme] = useState('dark');
  const [currency, setCurrency] = useState('USD');
  const profileUser = useAuthStore((state) => state.user);
  
  const address = useWalletStore((state) => state.address);
  const publicKey = useWalletStore((state) => state.publicKey);
  const encryptedPrivateKey = useWalletStore((state) => state.encryptedPrivateKey);
  const keyFingerprint = useWalletStore((state) => state.keyFingerprint);
  const algorithm = useWalletStore((state) => state.algorithm);
  const keyGeneratedAt = useWalletStore((state) => state.keyGeneratedAt);
  const walletVersion = useWalletStore((state) => state.walletVersion);
  const identityStatus = useWalletStore((state) => state.identityStatus);

  useEffect(() => {
    console.info(`[Profile] Address received: ${Boolean(address)}`);
    console.info(`[Profile] Public key received: ${Boolean(publicKey)}`);
  }, [address, publicKey]);

  const profileUsername = profileUser?.username || profileUser?.name || 'Loading...';
  const profileContact = profileUser?.email || profileUser?.phoneNumber || 'Loading...';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  const tabs = [
    { id: 'profile', label: 'Profile Settings', icon: <User size={18} /> },
    { id: 'preferences', label: 'Preferences', icon: <Sun size={18} /> },
    { id: 'security', label: 'Security & Keys', icon: <Lock size={18} /> },
    { id: 'help', label: 'Help & Support', icon: <HelpCircle size={18} /> },
    { id: 'about', label: 'About Us', icon: <Info size={18} /> },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700 fill-mode-both pb-20 md:pb-0">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">Settings</h1>
        <p className="text-neutral-400 text-base">Manage your account preferences and configurations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Settings Navigation */}
        <div className="md:col-span-1 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                activeTab === tab.id 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 font-medium">
                {tab.icon}
                {tab.label}
              </div>
              <ChevronRight size={16} className={activeTab === tab.id ? 'opacity-100' : 'opacity-0'} />
            </button>
          ))}
        </div>

        {/* Settings Content area */}
        <div className="md:col-span-3 bg-neutral-900/40 border border-white/5 rounded-3xl p-6 sm:p-8 backdrop-blur-xl">
          
          {/* Profile Section */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Profile Settings</h2>
                  <p className="text-sm text-neutral-400">View and manage your decentralized user identity.</p>
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Account Active
                </span>
              </div>
              
              {/* User Identity Card */}
              <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-400 via-cyan-500 to-blue-500 p-[3px] shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                  <div className="w-full h-full bg-neutral-900 rounded-[14px] flex items-center justify-center text-white text-3xl font-black">
                    {profileUsername.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <h3 className="text-xl font-bold text-white">{profileUsername}</h3>
                  <p className="text-sm text-neutral-400 font-mono">{profileContact}</p>
                  <div className="flex flex-wrap gap-2 pt-2 justify-center sm:justify-start">
                    <span className="text-xs px-2.5 py-1 bg-neutral-800 border border-white/10 rounded-lg text-neutral-300 font-mono">
                      UID: {profileUser?.id ? `${profileUser.id.substring(0, 10)}...` : 'Loading...'}
                    </span>
                    <span className="text-xs px-2.5 py-1 bg-neutral-800 border border-white/10 rounded-lg text-emerald-400 font-medium">
                      Tier: {profileUser?.accountTier || 'Not specified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profile Details Grid */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-400">Registered Username</label>
                    <input type="text" disabled value={profileUsername} className="w-full px-4 py-3 bg-[#121212] border border-neutral-800 rounded-xl text-white opacity-80 cursor-not-allowed font-medium" />
                    <p className="text-xs text-neutral-500">Decentralized handle linked to your on-chain wallet.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-400">Linked Contact</label>
                    <input type="text" disabled value={profileContact} className="w-full px-4 py-3 bg-[#121212] border border-neutral-800 rounded-xl text-white opacity-80 cursor-not-allowed font-mono" />
                    <p className="text-xs text-neutral-500">Primary phone number or email address.</p>
                  </div>
                </div>

                {/* Blockchain Metadata Overview */}
                <div className="p-4 bg-black/40 border border-white/5 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Blockchain Identity Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-neutral-900/60 rounded-lg border border-white/5">
                      <span className="text-neutral-500 block mb-1">Wallet Address</span>
                      <span className="font-mono text-white truncate block">{address ? `${address.substring(0, 8)}...${address.substring(address.length - 6)}` : identityStatus === 'error' ? 'Wallet unavailable' : 'Loading wallet...'}</span>
                    </div>
                    <div className="p-3 bg-neutral-900/60 rounded-lg border border-white/5">
                      <span className="text-neutral-500 block mb-1">Key Fingerprint</span>
                      <span className="font-mono text-emerald-400 block">{keyFingerprint || 'Pending'}</span>
                    </div>
                    <div className="p-3 bg-neutral-900/60 rounded-lg border border-white/5">
                      <span className="text-neutral-500 block mb-1">Key Algorithm</span>
                      <span className="font-medium text-white block">{algorithm || 'Pending'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-white/5 flex gap-3">
                  <Button 
                    onClick={() => {
                      const exportData = {
                        username: profileUsername,
                        contact: profileContact,
                        address,
                        publicKey,
                        keyFingerprint,
                        keyGeneratedAt,
                        exportedAt: new Date().toISOString()
                      };
                      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `securechain-profile-${profileUsername}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="bg-white text-neutral-950 hover:bg-neutral-200 font-semibold"
                  >
                    Export Profile Data
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Preferences Section */}
          {activeTab === 'preferences' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-bold text-white mb-6">Preferences</h2>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <h3 className="font-medium text-white">App Theme</h3>
                    <p className="text-sm text-neutral-400">Choose between dark and light mode.</p>
                  </div>
                  <div className="flex bg-neutral-900 rounded-lg p-1 border border-white/10">
                    <button onClick={() => setTheme('dark')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-400 hover:text-white'}`}>Dark</button>
                    <button onClick={() => setTheme('light')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${theme === 'light' ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-400 hover:text-white'}`}>Light</button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <h3 className="font-medium text-white">Primary Currency</h3>
                    <p className="text-sm text-neutral-400">Your default fiat display currency.</p>
                  </div>
                  <select 
                    value={currency} 
                    onChange={(e) => setCurrency(e.target.value)}
                    className="bg-[#121212] border border-neutral-800 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Security & Keys Section */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-bold text-white mb-6">Security & Keys</h2>
              
              <div className="space-y-4">
                {/* Cryptographic Keys */}
                <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-5">
                  <div 
                    className="flex items-center gap-3 mb-2 cursor-pointer select-none"
                  >
                    <Key className="text-emerald-400" size={20} />
                    <h3 className="font-medium text-white text-lg">Blockchain Keys</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Wallet Address</label>
                      <div className="flex items-center mt-1">
                        <input type="text" readOnly value={address || (identityStatus === 'error' ? 'Wallet unavailable' : 'Loading...')} className="w-full px-3 py-2 bg-[#121212] border border-neutral-800 rounded-l-lg text-sm text-neutral-300 font-mono" />
                        <button onClick={() => copyToClipboard(address || '')} className="px-3 py-2 bg-neutral-800 border border-l-0 border-neutral-800 rounded-r-lg text-neutral-400 hover:text-white transition-colors">
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Public Key</label>
                      <div className="flex items-center mt-1">
                        <input type="text" readOnly value={publicKey || (identityStatus === 'error' ? 'Wallet unavailable' : 'Loading...')} className="w-full px-3 py-2 bg-[#121212] border border-neutral-800 rounded-l-lg text-sm text-neutral-300 font-mono truncate" />
                        <button onClick={() => copyToClipboard(publicKey || '')} className="px-3 py-2 bg-neutral-800 border border-l-0 border-neutral-800 rounded-r-lg text-neutral-400 hover:text-white transition-colors">
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-end">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Private Key</label>
                        <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          {encryptedPrivateKey ? 'AES-256-GCM Encrypted • On-demand access' : 'Not Found'}
                        </span>
                      </div>
                      <div className="flex items-center mt-1">
                        <input type="text" readOnly value="Protected — accessed only when required for signing" className="w-full px-3 py-2 bg-[#121212] border border-neutral-800 rounded-lg text-sm text-emerald-400 font-mono" />
                      </div>
                    </div>
                    
                    <div className="pt-2 flex justify-between items-center text-xs text-neutral-500">
                      <span>Generated: {keyGeneratedAt ? new Date(keyGeneratedAt).toLocaleString() : 'N/A'}</span>
                      <span>{algorithm || 'Pending'} • v{walletVersion || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <Lock size={20} />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">Two-Factor Authentication</h3>
                      <p className="text-sm text-neutral-400">Add an extra layer of security.</p>
                    </div>
                  </div>
                  <Button variant="outline" className="border-white/10 text-white hover:bg-white/5">Enable</Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                      <User size={20} />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">Active Sessions</h3>
                      <p className="text-sm text-neutral-400">Manage your connected devices.</p>
                    </div>
                  </div>
                  <Button variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300">Log out all</Button>
                </div>
              </div>
            </div>
          )}

          {/* Help & Support Section */}
          {activeTab === 'help' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-bold text-white mb-6">Help & Support</h2>
              
              <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-4">
                <h3 className="text-lg font-semibold text-white">Need Assistance?</h3>
                <p className="text-neutral-400 leading-relaxed">
                  Our dedicated support team is available to help you with any issues regarding your wallet, transactions, or account settings.
                </p>
                <div className="flex items-center gap-3 p-4 bg-black/40 rounded-xl border border-white/5">
                  <Mail className="text-emerald-400" size={24} />
                  <div>
                    <p className="text-sm text-neutral-500">Direct Support Email</p>
                    <a href="mailto:support@securechain.pay" className="text-white font-medium hover:text-emerald-400 transition-colors">
                      aditya@securechain.pay
                    </a>
                  </div>
                </div>
                <Button className="w-full bg-emerald-500 text-black hover:bg-emerald-400 font-bold">
                  Open Support Ticket
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white mt-8 mb-4">Frequently Asked Questions</h3>
                {[
                  "How long do withdrawals take?",
                  "Are there any hidden gas fees?",
                  "How does the Account Abstraction work?"
                ].map((faq, i) => (
                  <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center cursor-pointer hover:bg-white/10 transition-colors">
                    <span className="text-sm font-medium text-neutral-300">{faq}</span>
                    <ChevronRight size={16} className="text-neutral-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* About Us Section */}
          {activeTab === 'about' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-bold text-white mb-6">About SecureChain Pay</h2>
              
              <div className="space-y-6 text-neutral-300 leading-relaxed">
                <p>
                  SecureChain Pay is a next-generation enterprise blockchain payment solution designed to bridge the gap between traditional finance and decentralized web3 infrastructure. 
                </p>
                <p>
                  Built by <span className="text-emerald-400 font-medium">Aditya Singh</span>, the platform focuses on solving the critical UX hurdles of crypto payments by leveraging Account Abstraction (ERC-4337) and zero-gas infrastructure on the Polygon network.
                </p>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 mt-6">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Version</p>
                    <p className="font-mono text-white">v2.4.0-enterprise</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Network</p>
                    <p className="font-mono text-emerald-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Polygon Mainnet
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button variant="outline" className="border-white/10 text-neutral-400 hover:text-white flex items-center gap-2">
                    Terms of Service <ExternalLink size={14} />
                  </Button>
                  <Button variant="outline" className="border-white/10 text-neutral-400 hover:text-white flex items-center gap-2">
                    Privacy Policy <ExternalLink size={14} />
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
