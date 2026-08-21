'use client';

import { useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { useWalletStore } from '@/stores/wallet-store';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter, usePathname } from 'next/navigation';
import { AlertCircle, RefreshCw, LogOut } from 'lucide-react';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);
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
              setWalletError(null);
              await initializeWallet(user.uid);
            } catch (error: any) {
              console.error('[SecureChain: Auth] Critical wallet init error:', error);
              setWalletError(error?.message || 'Failed to initialize cryptographic wallet.');
            }
          }
        })();

        // Execute both critical tasks concurrently in parallel
        await Promise.all([fetchProfilePromise, initWalletPromise]);
      } else {
        localStorage.removeItem('securechain_uid');
        clearAuthUser();
        disconnectWallet();
        setWalletError(null);
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

  const handleRetry = async () => {
    if (!auth.currentUser) return;
    setWalletError(null);
    setIsInitializing(true);
    try {
      await initializeWallet(auth.currentUser.uid);
    } catch (e: any) {
      setWalletError(e?.message || 'Wallet setup failed again.');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (e) {
      console.error(e);
    }
  };

  // If we already have keys in memory/cache, allow rendering immediately without blocking
  const hasLocalWallet = Boolean(address && encryptedPrivateKey);
  const isReady = _isWalletReady || hasLocalWallet;

  // Render initialization failure state clearly (never fake data)
  if (walletError && !isReady) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-[#0a0a0a] text-white p-6">
        <div className="max-w-md w-full bg-neutral-900/90 border border-red-500/20 p-8 rounded-3xl backdrop-blur-xl text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-xl font-bold text-white">Wallet Setup Failed</h2>
          <p className="text-sm text-neutral-400">
            {walletError || 'SecureChain could not initialize your cryptographic keys or genesis block.'}
          </p>
          <div className="space-y-3 pt-2">
            <button
              onClick={handleRetry}
              className="w-full py-3.5 px-6 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw size={16} /> Retry Setup
            </button>
            <button
              onClick={handleSignOut}
              className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all border border-white/10"
            >
              <LogOut size={14} /> Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

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


