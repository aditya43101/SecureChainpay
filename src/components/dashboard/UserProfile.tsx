'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User as UserIcon } from 'lucide-react';
import { auth, db } from '@/lib/firebase/client';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function UserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [displayUsername, setDisplayUsername] = useState<string>('Loading...');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Priority: Firestore username > displayName > email prefix > phone > Guest
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && userDoc.data().username) {
            setDisplayUsername(userDoc.data().username);
          } else {
            setDisplayUsername(
              currentUser.displayName || 
              currentUser.email?.split('@')[0] || 
              currentUser.phoneNumber || 
              'Guest'
            );
          }
        } catch {
          setDisplayUsername(
            currentUser.displayName || 
            currentUser.email?.split('@')[0] || 
            currentUser.phoneNumber || 
            'Guest'
          );
        }
      } else {
        setDisplayUsername('Guest');
      }
    });
    return () => unsubscribe();
  }, []);

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
