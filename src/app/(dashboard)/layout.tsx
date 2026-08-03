import Link from 'next/link';
import { Home, Wallet, History, Settings, Bell, Search, Database } from 'lucide-react';
import UserProfile from '@/components/dashboard/UserProfile';
import AuthProvider from '@/components/auth/AuthProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-[#0a0a0a] text-white flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col border-r border-white/5 bg-neutral-950/50 backdrop-blur-xl">
          <div className="h-20 flex items-center px-6 border-b border-white/5">
            <Link href="/dashboard" className="flex items-center gap-3 text-xl font-bold tracking-tight hover:opacity-90 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-[0_0_15px_rgba(52,211,153,0.3)] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-950"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              SecureChain
            </Link>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            <NavItem href="/dashboard" icon={<Home size={20} />} label="Overview" active />
            <NavItem href="/wallet" icon={<Wallet size={20} />} label="Wallet" />
            <NavItem href="/explorer" icon={<Database size={20} />} label="Block Explorer" />
            <NavItem href="/history" icon={<History size={20} />} label="Transactions" />
            <NavItem href="/settings" icon={<Settings size={20} />} label="Settings" />
          </nav>

          <UserProfile />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Topbar */}
          <header className="h-20 flex items-center justify-between px-6 border-b border-white/5 bg-neutral-950/50 backdrop-blur-xl sticky top-0 z-20">
            <div className="flex items-center gap-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Search transactions..." 
                  className="w-64 pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-white placeholder-neutral-500"
                />
              </div>
              <div className="md:hidden flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-950"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <span className="font-bold tracking-tight">SecureChain</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button className="p-2 relative text-neutral-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border border-[#0a0a0a]" />
              </button>
              <div className="sm:hidden w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500" />
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
            {/* Subtle background glow */}
            <div className="absolute top-0 left-1/4 w-[50%] h-[300px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
            {children}
          </div>
        </main>
        
        {/* Mobile Nav (Bottom) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-neutral-950 border-t border-white/10 flex items-center justify-around px-2 z-30 pb-safe">
          <MobileNavItem href="/dashboard" icon={<Home size={20} />} active />
          <MobileNavItem href="/wallet" icon={<Wallet size={20} />} />
          <MobileNavItem href="/explorer" icon={<Database size={20} />} />
          <MobileNavItem href="/history" icon={<History size={20} />} />
          <MobileNavItem href="/settings" icon={<Settings size={20} />} />
        </nav>
      </div>
    </AuthProvider>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link 
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 text-emerald-400 font-medium' 
          : 'text-neutral-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className={active ? 'text-emerald-400' : ''}>{icon}</span>
      {label}
    </Link>
  );
}

function MobileNavItem({ href, icon, active }: { href: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <Link href={href} className={`p-3 rounded-full transition-colors ${active ? 'text-emerald-400 bg-emerald-500/10' : 'text-neutral-500 hover:text-white'}`}>
      {icon}
    </Link>
  );
}
