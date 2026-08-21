'use client';

import { useEffect, useState, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { useWalletStore } from '@/stores/wallet-store';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const { initializeWallet, disconnectWallet, _isWalletReady, address, encryptedPrivateKey } = useWalletStore();
  const { login: setAuthUser, logout: clearAuthUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const initAttemptedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        localStorage.setItem('securechain_uid', user.uid);

        // 1. Parallel Task A: User profile retrieval
        const fetchProfilePromise = (async () => {
          try {
            const userDocSnap = await getDoc(doc(db, 'users', user.uid));
            const userData = userDocSnap.exists() ? userDocSnap.data() : null;
            const username = userData?.username || user.displayName;
            const displayName = username || user.displayName || user.email?.split('@')[0] || user.phoneNumber || 'Explorer';

            setAuthUser({
              id: user.uid,
              name: displayName,
              username: username || undefined,
              email: user.email || undefined,
              phoneNumber: user.phoneNumber || undefined,
              role: (userData?.role === 'admin' ? 'admin' : 'user'),
              avatar: user.photoURL || undefined,
            });
          } catch (profileErr) {
            console.warn('[SecureChain: Auth] Firestore profile fetch error, using fallback:', profileErr);
            setAuthUser({
              id: user.uid,
              name: user.displayName || user.email?.split('@')[0] || user.phoneNumber || 'Explorer',
              email: user.email || undefined,
              phoneNumber: user.phoneNumber || undefined,
              role: 'user',
              avatar: user.photoURL || undefined,
            });
          }
        })();

        // 2. Parallel Task B: Critical wallet state verification (keys, address, balances)
        const initWalletPromise = (async () => {
          if (!initAttemptedRef.current || !_isWalletReady) {
            initAttemptedRef.current = true;
            try {
              await initializeWallet(user.uid);
            } catch (error) {
              console.warn('[SecureChain: Auth] Critical wallet init warning:', error);
            }
          }
        })();

        // Execute both critical tasks concurrently in parallel
        await Promise.all([fetchProfilePromise, initWalletPromise]);
      } else {
        localStorage.removeItem('securechain_uid');
        clearAuthUser();
        disconnectWallet();
        initAttemptedRef.current = false;
        
        if (
          pathname?.startsWith('/dashboard') || 
          pathname?.startsWith('/wallet') || 
          pathname?.startsWith('/explorer') || 
          pathname?.startsWith('/transactions') || 
          pathname?.startsWith('/trade') || 
          pathname?.startsWith('/settings') ||
          pathname?.startsWith('/kyc')
        ) {
          router.push('/login');
        }
      }
      setIsInitializing(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeWallet, disconnectWallet]);

  // If we already have keys in memory/cache, allow rendering immediately without blocking
  const hasLocalWallet = Boolean(address && encryptedPrivateKey);
  const isReady = _isWalletReady || hasLocalWallet;

  // Render initial loading spinner ONLY for the few milliseconds critical state resolves
  if (isInitializing || (auth.currentUser && !isReady)) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#0a0a0a] p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-emerald-500/80 text-sm font-medium animate-pulse">Initializing SecureChain wallet...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


