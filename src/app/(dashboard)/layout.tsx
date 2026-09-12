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

interface NavLinkItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const mainNavLinks: NavLinkItem[] = [
    { href: '/dashboard', icon: <Home size={18} />, label: 'Overview', exact: true },
    { href: '/wallet', icon: <Wallet size={18} />, label: 'My Wallet' },
    { href: '/wallet/transfer', icon: <ArrowUpRight size={18} />, label: 'Send Money' },
    { href: '/wallet/receive', icon: <ArrowDownLeft size={18} />, label: 'Receive HSCT' },
    { href: '/trade', icon: <RefreshCcw size={18} />, label: 'Trade Crypto' },
  ];

  const toolsNavLinks: NavLinkItem[] = [
    { href: '/copilot', icon: <Bot size={18} />, label: 'Payment Copilot' },
    { href: '/explorer', icon: <Database size={18} />, label: 'Block Explorer' },
    { href: '/transactions', icon: <History size={18} />, label: 'Transactions' },
    { href: '/ai-assistant', icon: <Bot size={18} />, label: 'AI Assistant' },
  ];

  const enterpriseNavLinks: NavLinkItem[] = [
    { href: '/security', icon: <ShieldCheck size={18} />, label: 'Payment Security' },
    { href: '/routing', icon: <Sliders size={18} />, label: 'Routing Engine' },
    { href: '/integrity', icon: <ShieldAlert size={18} />, label: 'Integrity Layer' },
    { href: '/continuity', icon: <ShieldCheck size={18} />, label: 'Payment Continuity' },
    { href: '/predictive', icon: <Activity size={18} />, label: 'Predictive Ops' },
    { href: '/privacy', icon: <Fingerprint size={18} />, label: 'Privacy Center' },
    { href: '/reconciliation', icon: <Database size={18} />, label: 'Reconciliation' },
    { href: '/settings', icon: <Settings size={18} />, label: 'Settings' },
  ];

  const allNavLinks: NavLinkItem[] = [...mainNavLinks, ...toolsNavLinks, ...enterpriseNavLinks];

  const isLinkActive = (linkHref: string, exact?: boolean) => {
    if (exact) return pathname === linkHref;
    return pathname?.startsWith(linkHref);
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-black text-[#F8FAFC] flex flex-col md:flex-row antialiased selection:bg-[#FEEF8B]/30 selection:text-[#FEEF8B]">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 lg:w-72 flex-col border-r border-white/5 bg-[#0a0a0a]/95 backdrop-blur-2xl sticky top-0 h-screen z-30 flex-shrink-0">
          {/* Logo Header */}
          <div className="h-20 flex items-center px-6 border-b border-white/5">
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-95 transition-opacity">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FEF9C3] via-[#FEEF8B] to-[#F5C542] shadow-[0_0_16px_rgba(254,239,139,0.3)] flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={20} className="text-black" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold tracking-tight text-base text-white">
                  SecureChain <span className="text-[#FEEF8B]">Pay</span>
                </span>
                <span className="text-[10px] text-neutral-400 font-medium tracking-wide uppercase">Web3 Fintech</span>
              </div>
            </Link>
          </div>

          {/* Nav Categories */}
          <nav className="flex-1 px-4 py-5 space-y-6 overflow-y-auto custom-scrollbar">
            {/* Main Links */}
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Main</p>
              {mainNavLinks.map((item) => (
                <NavItem 
                  key={item.href} 
                  href={item.href} 
                  icon={item.icon} 
                  label={item.label} 
                  active={isLinkActive(item.href, item.exact)} 
                />
              ))}
            </div>

            {/* Tools & AI */}
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Fintech & AI</p>
              {toolsNavLinks.map((item) => (
                <NavItem 
                  key={item.href} 
                  href={item.href} 
                  icon={item.icon} 
                  label={item.label} 
                  active={isLinkActive(item.href, item.exact)} 
                />
              ))}
            </div>

            {/* Enterprise & Security */}
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Protocol & Controls</p>
              {enterpriseNavLinks.map((item) => (
                <NavItem 
                  key={item.href} 
                  href={item.href} 
                  icon={item.icon} 
                  label={item.label} 
                  active={isLinkActive(item.href, item.exact)} 
                />
              ))}
            </div>
          </nav>

          <UserProfile />
        </aside>

        {/* Mobile Slide-Out Drawer Backdrop & Menu */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
            <div 
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative w-4/5 max-w-xs bg-[#0a0a0a] border-r border-white/10 h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-300">
              <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
                <Link 
                  href="/dashboard"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-2.5"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FEF9C3] via-[#FEEF8B] to-[#F5C542] flex items-center justify-center">
                    <ShieldCheck size={18} className="text-black" strokeWidth={2.5} />
                  </div>
                  <span className="font-extrabold tracking-tight text-white text-sm">SecureChain <span className="text-[#FEEF8B]">Pay</span></span>
                </Link>
                <button 
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5"
                  aria-label="Close Navigation Menu"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
                <div className="space-y-1">
                  <p className="px-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Navigation</p>
                  {[...mainNavLinks, ...toolsNavLinks, ...enterpriseNavLinks].map((item) => (
                    <NavItem 
                      key={item.href} 
                      href={item.href} 
                      icon={item.icon} 
                      label={item.label} 
                      active={isLinkActive(item.href, item.exact)} 
                    />
                  ))}
                </div>
              </nav>

              <div className="p-3 border-t border-white/10">
                <UserProfile />
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-black">
          {/* Topbar */}
          <header className="h-16 sm:h-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-white/5 bg-black/90 backdrop-blur-xl sticky top-0 z-20">
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger Button */}
              <button 
                onClick={() => setMobileDrawerOpen(true)}
                className="md:hidden p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Open Navigation Menu"
              >
                <Menu size={20} />
              </button>

              {/* Desktop Search Bar */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                <input 
                  type="text" 
                  placeholder="Search transactions, blocks, addresses..." 
                  className="w-64 lg:w-80 pl-10 pr-4 py-2 bg-white/[0.04] border border-white/10 rounded-full text-xs font-medium focus:outline-none focus:border-[#FEEF8B]/50 focus:ring-1 focus:ring-[#FEEF8B]/30 transition-all text-white placeholder-neutral-500"
                />
              </div>

              {/* Mobile Brand Title */}
              <div className="md:hidden flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FEF9C3] via-[#FEEF8B] to-[#F5C542] flex items-center justify-center">
                  <ShieldCheck size={16} className="text-black" strokeWidth={2.5} />
                </div>
                <span className="font-extrabold tracking-tight text-sm text-white">SecureChain <span className="text-[#FEEF8B]">Pay</span></span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Network Pill */}
              <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FEEF8B]/10 border border-[#FEEF8B]/20 text-[#FEEF8B] text-xs font-semibold backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FEEF8B] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FEEF8B]"></span>
                </span>
                <span>Mainnet</span>
              </div>

              {/* Notification Button */}
              <button 
                className="p-2 relative text-neutral-400 hover:text-white transition-colors rounded-full hover:bg-white/5 min-h-[40px] min-w-[40px] flex items-center justify-center" 
                aria-label="Notifications"
              >
                <Bell size={18} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#FEEF8B] rounded-full shadow-[0_0_8px_rgba(254,239,139,0.8)]" />
              </button>

              {/* User Avatar */}
              <Link 
                href="/settings" 
                title="View Account Settings"
                className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FEF9C3] to-[#F5C542] p-[1.5px] shadow-[0_0_12px_rgba(254,239,139,0.2)] hover:scale-105 transition-transform flex items-center justify-center cursor-pointer min-h-[40px] min-w-[40px]"
              >
                <div className="w-full h-full bg-[#0a0a0a] rounded-[10px] flex items-center justify-center text-[#FEEF8B]">
                  <User size={16} />
                </div>
              </Link>
            </div>
          </header>

          {/* Page Content Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-12 relative min-w-0 bg-black">
            {/* Subtle background glow */}
            <div className="absolute top-0 left-1/4 w-[50%] h-[300px] bg-[#FEEF8B]/5 rounded-full blur-[140px] pointer-events-none" />
            {children}
          </div>

          {/* Floating AI Assistant Ball */}
          <AIAssistiveBall />
        </main>
        
        {/* Mobile Nav (Bottom Bar with min 48px tap targets) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/95 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around px-2 z-40 pb-safe shadow-[0_-8px_20px_rgba(0,0,0,0.5)]">
          <MobileNavItem href="/dashboard" icon={<Home size={20} />} label="Home" active={pathname === '/dashboard'} />
          <MobileNavItem href="/wallet" icon={<Wallet size={20} />} label="Wallet" active={pathname === '/wallet'} />
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
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[40px] ${
        active 
          ? 'bg-[#FEEF8B]/10 text-[#FEEF8B] font-bold border border-[#FEEF8B]/25 shadow-[0_0_12px_rgba(254,239,139,0.08)]' 
          : 'text-neutral-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
      }`}
    >
      <span className={active ? 'text-[#FEEF8B]' : 'text-neutral-400'}>{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function MobileNavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] px-2 py-1 rounded-xl transition-all ${
        active ? 'text-[#FEEF8B] font-bold scale-105' : 'text-neutral-400 hover:text-neutral-200'
      }`}
    >
      <div className={`p-1 rounded-lg ${active ? 'bg-[#FEEF8B]/15 text-[#FEEF8B]' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] mt-0.5 tracking-tight font-medium">{label}</span>
    </Link>
  );
}
