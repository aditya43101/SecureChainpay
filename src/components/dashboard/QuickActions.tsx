import { ArrowUpRight, ArrowDownLeft, RefreshCcw, Bot } from 'lucide-react';
import Link from 'next/link';

export function QuickActions() {
  const actions = [
    { 
      name: 'Send', 
      desc: 'HSCT transfer',
      href: '/wallet/transfer', 
      icon: <ArrowUpRight size={22} />, 
      bg: 'bg-[#FEEF8B] text-black',
      shadow: 'shadow-[0_0_18px_rgba(254,239,139,0.3)]',
      border: 'border-[#FEEF8B]/40',
      badge: 'HSCT Only'
    },
    { 
      name: 'Receive', 
      desc: 'HSCT QR & Pay',
      href: '/wallet/receive', 
      icon: <ArrowDownLeft size={22} />, 
      bg: 'bg-white/10 text-white group-hover:bg-white/15',
      shadow: 'shadow-none',
      border: 'border-white/10',
      badge: 'Instant'
    },
    { 
      name: 'Trade', 
      desc: 'All crypto pairs',
      href: '/trade', 
      icon: <RefreshCcw size={20} />, 
      bg: 'bg-white/10 text-white group-hover:bg-white/15',
      shadow: 'shadow-none',
      border: 'border-white/10',
      badge: 'Live Terminal'
    },
    { 
      name: 'Copilot', 
      desc: 'AI Assistant',
      href: '/copilot', 
      icon: <Bot size={22} />, 
      bg: 'bg-white/10 text-[#FEEF8B] group-hover:bg-[#FEEF8B]/10',
      shadow: 'shadow-none',
      border: 'border-[#FEEF8B]/20',
      badge: 'Smart'
    },
  ];

  return (
    <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 sm:p-7 h-full flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Quick Actions</h3>
        <span className="text-[11px] font-semibold text-neutral-400 bg-white/[0.04] px-2.5 py-1 rounded-full border border-white/5">
          Fast Access
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5 flex-1">
        {actions.map((action) => (
          <Link 
            key={action.name}
            href={action.href}
            className="flex flex-col items-center justify-center text-center p-3.5 sm:p-4 rounded-2xl bg-[#121212] border border-white/5 hover:border-[#FEEF8B]/30 hover:bg-[#1a1a1a] transition-all duration-200 group min-h-[90px]"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${action.bg} ${action.shadow} ${action.border} border transition-all duration-200 group-hover:scale-105 mb-2`}>
              {action.icon}
            </div>
            
            <span className="text-xs sm:text-sm font-bold text-white group-hover:text-[#FEEF8B] transition-colors leading-tight">
              {action.name}
            </span>
            <span className="text-[10px] text-neutral-400 font-medium mt-0.5 hidden sm:block">
              {action.desc}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
