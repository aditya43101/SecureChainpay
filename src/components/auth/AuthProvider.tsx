'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useWalletStore } from '@/stores/wallet-store';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const { initializeWallet, disconnectWallet, _hasHydrated } = useWalletStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Save the UID securely in local storage so Zustand persist can access it immediately
        localStorage.setItem('securechain_uid', user.uid);
        
        const hasWalletLocally = !!useWalletStore.getState().encryptedPrivateKey;
        
        if (!hasWalletLocally) {
          setIsProvisioning(true);
          console.log("[SecureChain: Provisioning] Blocking UI for secure wallet setup...");
          try {
            await initializeWallet(user.uid);
            console.log("[SecureChain: Provisioning] Setup complete.");
          } catch (error) {
            console.error("[SecureChain: Fatal Error] Wallet setup failed:", error);
          } finally {
            setIsProvisioning(false);
          }
        } else {
          // Background sync: Do NOT await this, let UI render immediately from cache
          console.log("[SecureChain: Initializing] Fetching wallet state for user:", user.uid);
          initializeWallet(user.uid)
            .then(() => console.log("[SecureChain: Success] Wallet Hydrated and Synced."))
            .catch((error) => {
              console.error("[SecureChain: Error] Wallet initialization failed, attempting cache recovery...", error);
              localStorage.removeItem(`securechain-wallet-${user.uid}`);
              initializeWallet(user.uid)
                .then(() => console.log("[SecureChain: Recovery] Cache recovery successful."))
                .catch(recoveryErr => console.error("[SecureChain: Fatal Error] Cache recovery failed:", recoveryErr));
            });
        }
      } else {
        localStorage.removeItem('securechain_uid');
        disconnectWallet();
        
        // Redirect to login if on a protected route
        if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/wallet') || pathname?.startsWith('/explorer') || pathname?.startsWith('/transactions') || pathname?.startsWith('/trade')) {
          router.push('/login');
        }
      }
      setIsInitializing(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeWallet, disconnectWallet]);

  if (isProvisioning) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-[#0a0a0a] text-white">
        <span className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-6" />
        <h2 className="text-2xl font-bold animate-pulse tracking-tight text-emerald-400">Setting up your secure blockchain wallet...</h2>
        <p className="text-neutral-500 mt-2 text-sm max-w-md text-center">Generating cryptographic keys and initializing genesis block. Please do not close this page.</p>
      </div>
    );
  }

  if (isInitializing || (auth.currentUser && !_hasHydrated)) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#0a0a0a]">
        <span className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
