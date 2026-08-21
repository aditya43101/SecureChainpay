'use client';

import { useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { useWalletStore } from '@/stores/wallet-store';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter, usePathname } from 'next/navigation';
import { RefreshCw, AlertTriangle, ArrowRight, LogOut } from 'lucide-react';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [syncTimeoutReached, setSyncTimeoutReached] = useState(false);
  const { initializeWallet, disconnectWallet, _isWalletReady, address, encryptedPrivateKey } = useWalletStore();
  const { login: setAuthUser, logout: clearAuthUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const initAttemptedRef = useRef(false);

  // Safety watchdog timer: if sync takes > 5 seconds, allow fallback access
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isInitializing || isProvisioning || (auth.currentUser && !_isWalletReady)) {
        console.warn('[SecureChain: Auth] Sync watchdog triggered after 5s. Providing fallback access.');
        setSyncTimeoutReached(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isInitializing, isProvisioning, _isWalletReady]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        localStorage.setItem('securechain_uid', user.uid);

        // Fetch user profile from Firestore
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
          console.warn('[SecureChain: Auth] Failed to fetch Firestore profile, using auth fallback:', profileErr);
          setAuthUser({
            id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || user.phoneNumber || 'Explorer',
            email: user.email || undefined,
            phoneNumber: user.phoneNumber || undefined,
            role: 'user',
            avatar: user.photoURL || undefined,
          });
        }
        
        // Initialize wallet
        if (!initAttemptedRef.current || !_isWalletReady) {
          initAttemptedRef.current = true;
          setIsProvisioning(true);
          console.log("[SecureChain: Auth] User detected. Starting wallet initialization...");
          
          try {
            await initializeWallet(user.uid);
            console.log("[SecureChain: Auth] ✓ Wallet initialization complete.");
          } catch (error) {
            console.error("[SecureChain: Auth] ✗ Wallet setup warning:", error);
            try {
              localStorage.removeItem(`securechain-wallet-${user.uid}`);
              await initializeWallet(user.uid);
            } catch (recoveryErr) {
              console.error("[SecureChain: Auth] ✗ Fallback wallet setup:", recoveryErr);
            }
          } finally {
            setIsProvisioning(false);
          }
        }
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

  const handleForceEnter = () => {
    if (auth.currentUser) {
      // Force set ready to unblock user
      useWalletStore.setState({ _isWalletReady: true, _hasHydrated: true });
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
  const isReady = _isWalletReady || hasLocalWallet || syncTimeoutReached;

  // Show provisioning screen while fresh wallet is being generated
  if (isProvisioning && !hasLocalWallet && !syncTimeoutReached) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-[#0a0a0a] text-white p-6">
        <span className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-6" />
        <h2 className="text-2xl font-bold animate-pulse tracking-tight text-emerald-400 text-center">Setting up your secure blockchain wallet...</h2>
        <p className="text-neutral-500 mt-2 text-sm max-w-md text-center">Generating cryptographic keys and initializing genesis block. Please do not close this page.</p>
      </div>
    );
  }

  // If initializing and not ready yet, show loader with watchdog recovery options if delayed
  if ((isInitializing || (auth.currentUser && !isReady)) && !syncTimeoutReached) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#0a0a0a] p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-emerald-500/80 text-sm font-medium animate-pulse">Syncing blockchain metadata...</span>
        </div>
      </div>
    );
  }

  // Recovery screen if sync watchdog timed out or encountered extreme latency
  if (auth.currentUser && !_isWalletReady && syncTimeoutReached && !hasLocalWallet) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-[#0a0a0a] text-white p-6">
        <div className="max-w-md w-full bg-neutral-900/80 border border-white/10 p-8 rounded-3xl backdrop-blur-xl text-center space-y-5">
          <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-xl font-bold text-white">Metadata Sync Taking Longer</h2>
          <p className="text-sm text-neutral-400">
            Network latency is delaying full cloud metadata verification. You can continue to your profile and dashboard immediately using local cryptographic caching.
          </p>
          <div className="space-y-3 pt-2">
            <button
              onClick={handleForceEnter}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-neutral-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)]"
            >
              Continue to Dashboard <ArrowRight size={16} />
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSyncTimeoutReached(false);
                  if (auth.currentUser) initializeWallet(auth.currentUser.uid);
                }}
                className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw size={14} /> Retry Sync
              </button>
              <button
                onClick={handleSignOut}
                className="flex-1 py-3 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

