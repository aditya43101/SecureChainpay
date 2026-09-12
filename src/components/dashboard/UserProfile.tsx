'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User as UserIcon } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import { useAuthStore } from '@/stores/auth-store';

export default function UserProfile() {
  const displayUser = useAuthStore((state) => state.user);
  const displayUsername = displayUser?.username || displayUser?.name || 'Loading...';
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <div className="p-3.5 border-t border-white/5">
      <div 
        onClick={() => router.push('/settings')}
        title="View Profile Settings"
        className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 mb-2 cursor-pointer hover:bg-white/[0.07] hover:border-[#FEEF8B]/30 transition-all duration-200 group"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FEEF8B] to-[#F5C542] p-[1.5px] group-hover:scale-105 transition-transform flex-shrink-0 shadow-[0_0_12px_rgba(254,239,139,0.2)]">
          <div className="w-full h-full bg-[#0a0a0a] rounded-[10px] flex items-center justify-center text-[#FEEF8B] font-bold text-xs">
            {displayUsername.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:text-[#FEEF8B] transition-colors">{displayUsername}</p>
          <p className="text-[11px] text-neutral-400 group-hover:text-neutral-300 transition-colors">Non-custodial • Settings →</p>
        </div>
      </div>
      <button 
        onClick={handleLogout}
        className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-rose-400 transition-colors w-full rounded-xl hover:bg-rose-500/10 min-h-[38px]"
      >
        <LogOut size={15} />
        Log out
      </button>
    </div>
  );
}
