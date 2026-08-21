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
    <div className="p-4 border-t border-white/5">
      <div 
        onClick={() => router.push('/settings')}
        title="View Profile Settings"
        className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5 border border-white/10 mb-3 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all duration-200 group"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 p-[2px] group-hover:scale-105 transition-transform">
          <div className="w-full h-full bg-neutral-900 rounded-full border-2 border-transparent flex items-center justify-center">
            <UserIcon size={16} className="text-emerald-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate group-hover:text-emerald-400 transition-colors">{displayUsername}</p>
          <p className="text-xs text-neutral-500 group-hover:text-emerald-400/80 transition-colors">Profile Settings →</p>
        </div>
      </div>
      <button 
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-neutral-400 hover:text-red-400 transition-colors w-full rounded-lg hover:bg-red-500/10"
      >
        <LogOut size={16} />
        Log out
      </button>
    </div>
  );
}
