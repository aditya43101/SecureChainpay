'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, Wallet, History, Settings, Bell, Search, Database, User, Bot, 
  ShieldCheck, Sliders, ShieldAlert, Activity, Fingerprint, Menu, X, ArrowUpRight, ArrowDownLeft, RefreshCcw
} from 'lucide-react';
import UserProfile from '@/components/dashboard/UserProfile';
import AuthProvider from '@/components/auth/AuthProvider';
import { AIAssistiveBall } from '@/components/trading-ai/AIAssistiveBall';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const navLinks = [
    { href: '/dashboard', icon: <Home size={20} />, label: 'Overview', exact: true },
    { href: '/wallet', icon: <Wallet size={20} />, label: 'My Wallet' },
    { href: '/wallet/transfer', icon: <ArrowUpRight size={20} />, label: 'Send Money' },
    { href: '/wallet/receive', icon: <ArrowDownLeft size={20} />, label: 'Receive HSCT' },
    { href: '/trade', icon: <RefreshCcw size={20} />, label: 'Trade Crypto' },
    { href: '/explorer', icon: <Database size={20} />, label: 'Block Explorer' },
    { href: '/transactions', icon: <History size={20} />, label: 'Transactions' },
    { href: '/reconciliation', icon: <Database size={20} />, label: 'Reconciliation' },
    { href: '/security', icon: <ShieldCheck size={20} />, label: 'Payment Security' },
    { href: '/routing', icon: <Sliders size={20} />, label: 'Routing Engine' },
    { href: '/integrity', icon: <ShieldAlert size={20} />, label: 'Integrity Layer' },
    { href: '/continuity', icon: <ShieldCheck size={20} />, label: 'Payment Continuity' },
    { href: '/predictive', icon: <Activity size={20} />, label: 'Predictive Ops' },
    { href: '/privacy', icon: <Fingerprint size={20} />, label: 'Privacy Center' },
    { href: '/copilot', icon: <Bot size={20} />, label: 'Payment Copilot' },
    { href: '/ai-assistant', icon: <Bot size={20} />, label: 'AI Assistant' },
    { href: '/settings', icon: <Settings size={20} />, label: 'Settings' },
  ];

  const isLinkActive = (linkHref: string, exact?: boolean) => {
    if (exact) return pathname === linkHref;
    return pathname?.startsWith(linkHref);
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col md:flex-row">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col border-r border-white/5 bg-neutral-950/70 backdrop-blur-xl sticky top-0 h-screen z-30">
          <div className="h-20 flex items-center px-6 border-b border-white/5">
            <Link href="/dashboard" className="flex items-center gap-3 text-xl font-bold tracking-tight hover:opacity-90 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-[0_0_15px_rgba(52,211,153,0.3)] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-950"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <span className="font-extrabold tracking-tight">SecureChain</span>
            </Link>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
            {navLinks.map((item) => (
              <NavItem 
                key={item.href} 
                href={item.href} 
                icon={item.icon} 
                label={item.label} 
                active={isLinkActive(item.href, item.exact)} 
              />
            ))}
          </nav>

          <UserProfile />
        </aside>

        {/* Mobile Slide-Out Drawer Backdrop & Menu */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative w-4/5 max-w-xs bg-neutral-950 border-r border-white/10 h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-300">
              <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
                <Link 
                  href="/dashboard" 
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-2.5 font-bold tracking-tight text-white"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-950"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <span className="font-extrabold">SecureChain Pay</span>
                </Link>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                {navLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isLinkActive(item.href, item.exact)
                        ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className={isLinkActive(item.href, item.exact) ? 'text-emerald-400' : ''}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>

              <div className="p-4 border-t border-white/10">
                <UserProfile />
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Topbar */}
          <header className="h-16 sm:h-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-white/5 bg-neutral-950/70 backdrop-blur-xl sticky top-0 z-20">
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger Button */}
              <button 
                onClick={() => setMobileDrawerOpen(true)}
                className="md:hidden p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
                aria-label="Open Navigation Menu"
              >
                <Menu size={20} />
              </button>

              <div className="relative hidden md:block">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" size={17} />
                <input 
                  type="text" 
                  placeholder="Search transactions, blocks, hashes..." 
                  className="w-64 lg:w-80 pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-white placeholder-neutral-500"
                />
              </div>

              {/* Mobile Brand Title */}
              <div className="md:hidden flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-950"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <span className="font-extrabold tracking-tight text-sm sm:text-base text-white">SecureChain</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <button className="p-2 relative text-neutral-400 hover:text-white transition-colors rounded-full hover:bg-white/5" aria-label="Notifications">
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border border-[#0a0a0a]" />
              </button>
              <Link 
                href="/profile" 
                title="View Profile Settings"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-400 to-cyan-500 p-[1.5px] shadow-[0_0_12px_rgba(52,211,153,0.3)] hover:scale-105 transition-transform flex items-center justify-center cursor-pointer"
              >
                <div className="w-full h-full bg-neutral-900 rounded-[10px] flex items-center justify-center text-emerald-400">
                  <User size={15} />
                </div>
              </Link>
            </div>
          </header>

          {/* Page Content Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-12 relative min-w-0">
            {/* Subtle background glow */}
            <div className="absolute top-0 left-1/4 w-[50%] h-[300px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
            {children}
          </div>

          {/* Floating AI Assistant Ball */}
          <AIAssistiveBall />
        </main>
        
        {/* Mobile Nav (Bottom Bar with min 44px tap targets) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-neutral-950/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-2 z-40 pb-safe">
          <MobileNavItem href="/dashboard" icon={<Home size={20} />} label="Home" active={pathname === '/dashboard'} />
          <MobileNavItem href="/wallet" icon={<Wallet size={20} />} label="Wallet" active={pathname?.startsWith('/wallet')} />
          <MobileNavItem href="/wallet/transfer" icon={<ArrowUpRight size={20} />} label="Send" active={pathname?.startsWith('/wallet/transfer')} />
          <MobileNavItem href="/explorer" icon={<Database size={20} />} label="Explorer" active={pathname?.startsWith('/explorer')} />
          <MobileNavItem href="/settings" icon={<Settings size={20} />} label="Settings" active={pathname?.startsWith('/settings') || pathname === '/profile'} />
        </nav>
      </div>
    </AuthProvider>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link 
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
        active 
          ? 'bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 text-emerald-400 font-bold border border-emerald-500/20 shadow-sm' 
          : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      <span className={active ? 'text-emerald-400' : ''}>{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function MobileNavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 rounded-xl transition-colors ${
        active ? 'text-emerald-400 font-bold' : 'text-neutral-500 hover:text-neutral-200'
      }`}
    >
      <div className={`p-1 rounded-lg ${active ? 'bg-emerald-500/10' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] mt-0.5 tracking-tight font-medium">{label}</span>
    </Link>
  );
}
