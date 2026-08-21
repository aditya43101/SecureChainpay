'use client';

import { useEffect, useState, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { useWalletStore } from '@/stores/wallet-store';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter, usePathname } from 'next/navigation';

const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
const getElapsed = () => `+${Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)}ms`;

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const { initializeWallet, disconnectWallet, _isWalletReady, ownerUid, address, encryptedPrivateKey } = useWalletStore();
  const { user: authUser, login: setAuthUser, logout: clearAuthUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const initAttemptedRef = useRef(false);

  console.log(`[AUTH ${getElapsed()}] AuthProvider render - isInitializing: ${isInitializing}, _isWalletReady: ${_isWalletReady}, hasAddress: ${Boolean(address)}`);

  useEffect(() => {
    console.log(`[AUTH ${getElapsed()}] AuthProvider mounted in DOM`);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log(`[AUTH ${getElapsed()}] Firebase auth callback START - UID: ${user?.uid || 'NONE'}`);
      try {
        if (user) {
          localStorage.setItem('securechain_uid', user.uid);

          // 1. Parallel Task A: User profile retrieval (with 1.5s fast-path timeout)
          const fetchProfilePromise = (async () => {
            const pStart = performance.now();
            console.log(`[AUTH ${getElapsed()}] Profile fetch START`);
            try {
              const fetchWithTimeout = Promise.race([
                getDoc(doc(db, 'users', user.uid)),
                new Promise<null>((_, reject) => 
                  setTimeout(() => reject(new Error('Profile read timeout')), 1500)
                )
              ]);
              const userDocSnap = await fetchWithTimeout;
              const userData = userDocSnap && typeof userDocSnap.exists === 'function' && userDocSnap.exists() ? userDocSnap.data() : null;
              const username = userData?.username || user.displayName;
              const displayName = username || user.displayName || user.email?.split('@')[0] || user.phoneNumber || 'Explorer';

              setAuthUser({
                id: user.uid,
                name: displayName,
                username: username || undefined,
                email: user.email || undefined,
                phoneNumber: user.phoneNumber || undefined,
                accountTier: userData?.accountTier || undefined,
                role: (String(userData?.role || '').toLowerCase() === 'admin' ? 'admin' : 'user'),
                avatar: user.photoURL || undefined,
              });
              console.log(`[AUTH ${getElapsed()}] Profile fetch END (took ${Math.round(performance.now() - pStart)}ms)`);
            } catch (profileErr) {
              console.warn(`[AUTH ${getElapsed()}] Firestore profile fetch warning (using fallback):`, profileErr);
              setAuthUser({
                id: user.uid,
                name: user.displayName || user.email?.split('@')[0] || user.phoneNumber || 'Explorer',
                email: user.email || undefined,
                phoneNumber: user.phoneNumber || undefined,
                accountTier: undefined,
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
              } catch (error: any) {
                console.error(`[AUTH ${getElapsed()}] Critical wallet init error:`, error);
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
            || pathname?.startsWith('/admin-dashboard')
            || pathname?.startsWith('/audit-logs')
          ) {
            router.push('/login');
          }
        }
      } catch (authHandlerErr) {
        console.error(`[AUTH ${getElapsed()}] Uncaught auth handler exception:`, authHandlerErr);
      } finally {
        console.log(`[AUTH ${getElapsed()}] setIsInitializing(false)`);
        setIsInitializing(false);
      }
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeWallet, disconnectWallet]);

  // Cached wallet fast-path: Only trust local wallet if ownership matches the current authenticated UID
  const isLocalWalletOwner = typeof window !== 'undefined' && auth.currentUser && localStorage.getItem('securechain_uid') === auth.currentUser.uid;
  const hasLocalWallet = Boolean(isLocalWalletOwner && ownerUid === auth.currentUser?.uid && address && encryptedPrivateKey);
  if (!isInitializing && pathname?.startsWith('/admin-dashboard') && authUser && authUser.role !== 'admin') {
    router.replace('/dashboard');
    return null;
  }

  if (!isInitializing && pathname?.startsWith('/audit-logs') && authUser && authUser.role !== 'admin') {
    router.replace('/dashboard');
    return null;
  }

  console.log(`[AUTH ${getElapsed()}] Authenticated app render -> isInitializing: ${isInitializing}, hasLocalWallet: ${hasLocalWallet}, _isWalletReady: ${_isWalletReady}`);

  return <>{children}</>;
}
