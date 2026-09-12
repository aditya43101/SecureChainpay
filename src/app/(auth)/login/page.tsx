'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, RefreshCw, CheckCircle, AlertCircle, Sparkles, User, ShieldCheck } from 'lucide-react';
import { auth, db } from '@/lib/firebase/client';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  updateProfile, 
  signInAnonymously,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

function LoginContent() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameValid, setUsernameValid] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Auto-redirect if user already has an active authenticated session
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && isMountedRef.current) {
        localStorage.setItem('securechain_uid', user.uid);
        router.replace('/settings');
      }
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [router]);

  // Username validation check against Firestore
  const checkUsernameUnique = async (uname: string): Promise<boolean> => {
    if (!uname || uname.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      setUsernameValid(false);
      return false;
    }
    
    setIsCheckingUsername(true);
    setUsernameError(null);
    
    try {
      const unameDoc = await getDoc(doc(db, 'usernames', uname.toLowerCase()));
      if (unameDoc.exists()) {
        setUsernameError('This username is already taken. Please choose another.');
        setUsernameValid(false);
        return false;
      } else {
        setUsernameError(null);
        setUsernameValid(true);
        return true;
      }
    } catch (err: any) {
      console.warn('Username check error, continuing with fallback:', err);
      setUsernameValid(true);
      return true;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
    const normalizedVal = rawVal.trim().toLowerCase();
    
    setUsername(normalizedVal);
    setUsernameValid(false);
    setUsernameError(null);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (normalizedVal.length >= 3) {
      debounceRef.current = setTimeout(() => {
        checkUsernameUnique(normalizedVal);
      }, 400);
    } else if (normalizedVal.length > 0) {
      setUsernameError('Username must be at least 3 characters');
    }
  };

  // Post-auth logic — save user data or validate existing account
  const handleAuthSuccess = async (user: any, chosenUsername?: string) => {
    localStorage.setItem('securechain_uid', user.uid);
    router.replace('/settings');

    void (async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        let userDocSnap: any = null;
        try {
          userDocSnap = await getDoc(userDocRef);
        } catch (e) {
          console.warn('User document read warning:', e);
        }

        const effectiveUsername = chosenUsername || username || user.displayName || `user_${user.uid.substring(0, 6)}`;
        const normalizedUsername = effectiveUsername.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
        
        if (!userDocSnap?.exists()) {
          try {
            await setDoc(doc(db, 'usernames', normalizedUsername), { uid: user.uid });
          } catch (unameErr) {
            console.warn('Username reservation warning:', unameErr);
          }
          try {
            await setDoc(userDocRef, {
              username: normalizedUsername,
              displayName: user.displayName || normalizedUsername,
              name: user.displayName || normalizedUsername,
              email: user.email || null,
              role: 'USER',
              createdAt: new Date().toISOString()
            }, { merge: true });
          } catch (docErr) {
            console.warn('User profile auto-provision warning:', docErr);
          }
          try {
            await updateProfile(user, { displayName: user.displayName || normalizedUsername });
          } catch (profileErr) {
            console.warn('Firebase profile update warning:', profileErr);
          }
        }
      } catch (err: any) {
        console.warn('Post-auth background tasks caught warning:', err);
      }
    })();
  };

  // Primary Google Sign-In / Sign-Up
  const handleGoogleAuth = async () => {
    if (mode === 'register') {
      if (!username || username.length < 3) {
        setError('Please choose a username (minimum 3 characters) first.');
        return;
      }
      const isUnique = await checkUsernameUnique(username);
      if (!isUnique) {
        setError(usernameError || 'Please choose a different username.');
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      setSuccess('Google authentication successful! Redirecting...');
      await handleAuthSuccess(result.user, username || undefined);
    } catch (err: any) {
      console.error('Google auth error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in window was closed. Please try again.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignored
      } else {
        setError(err.message || 'Failed to authenticate with Google. Please try again.');
      }
      setIsLoading(false);
    }
  };

  // Dev Quick Login Bypass (functional testing session)
  const handleDevBypass = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cred = await signInAnonymously(auth);
      const testUsername = username || `dev_user_${Math.floor(1000 + Math.random() * 9000)}`;
      await handleAuthSuccess(cred.user, testUsername);
    } catch (devErr: any) {
      console.error('Dev login bypass error:', devErr);
      setError('Dev login failed: ' + (devErr.message || 'Unknown error'));
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full relative animate-in fade-in zoom-in-95 duration-700 max-w-md mx-auto px-2 sm:px-0">
      
      {/* Premium Glass Card */}
      <div className="backdrop-blur-2xl bg-[#0a0a0a] border border-white/10 p-6 sm:p-8 md:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        
        {/* Subtle inner glow */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#FEEF8B]/40 to-transparent" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FEEF8B]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Logo & Header */}
        <div className="text-center mb-8 space-y-3 relative z-10">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-2xl bg-black/80 border border-[#FEEF8B]/30 shadow-[0_0_25px_rgba(254,239,139,0.25)] flex items-center justify-center transform hover:scale-105 transition-transform duration-500 p-2">
              <img 
                src="/logo.svg" 
                alt="SecureChain Pay Logo" 
                className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(254,239,139,0.4)]" 
              />
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            SecureChain <span className="text-[#FEEF8B]">Pay</span>
          </h1>
          <p className="text-xs text-neutral-400 font-medium">
            {mode === 'login' 
              ? 'Access your non-custodial decentralized crypto wallet' 
              : 'Create your decentralized enterprise blockchain account'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-[#121212] border border-white/5 p-1 rounded-2xl mb-6 relative z-10">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-[#FEEF8B] text-neutral-950 shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-[#FEEF8B] text-neutral-950 shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mb-5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs px-4 py-3 rounded-xl flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle size={15} className="flex-shrink-0 text-rose-400" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle size={15} className="flex-shrink-0" />
            <span className="leading-relaxed">{success}</span>
          </div>
        )}

        {/* Main Actions Form */}
        <div className="space-y-4 relative z-10">
          
          {/* Custom Username Input (Shown for Register) */}
          {mode === 'register' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                <span>Choose Your Username</span>
                {isCheckingUsername && (
                  <span className="text-[10px] text-[#FEEF8B] lowercase font-normal flex items-center gap-1">
                    <RefreshCw size={10} className="animate-spin" /> checking availability...
                  </span>
                )}
                {usernameValid && !isCheckingUsername && (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle size={10} /> available
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-mono font-bold text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="aditya_01"
                  maxLength={24}
                  className={`w-full bg-black border ${
                    usernameError ? 'border-rose-500/50' : usernameValid ? 'border-emerald-500/50' : 'border-white/10'
                  } pl-8 pr-4 py-3.5 rounded-xl text-white font-mono text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FEEF8B]/50 transition-colors min-h-[48px]`}
                />
              </div>
              {usernameError && (
                <p className="text-[11px] text-rose-400 font-medium">{usernameError}</p>
              )}
              <p className="text-[11px] text-neutral-500">
                Your unique handle for P2P transfers and friend payments.
              </p>
            </div>
          )}

          {/* Primary Google Auth Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isLoading || (mode === 'register' && (!username || !usernameValid))}
            className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-sm transition-all flex items-center justify-center gap-3 shadow-lg min-h-[50px] ${
              isLoading || (mode === 'register' && (!username || !usernameValid))
                ? 'bg-white/10 text-neutral-500 cursor-not-allowed border border-white/5'
                : 'bg-white text-neutral-950 hover:bg-neutral-100 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-[0.99]'
            }`}
          >
            {isLoading ? (
              <RefreshCw size={18} className="animate-spin text-neutral-500" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>
              {mode === 'login' ? 'Sign In with Google' : 'Create Account with Google'}
            </span>
          </button>

          {/* Non-Custodial Badge Notice */}
          <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-neutral-500 font-medium">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Non-custodial ECDSA cryptographic security</span>
          </div>

          {/* Quick Dev/Demo Bypass Button */}
          <div className="pt-4 border-t border-white/5 text-center">
            <button
              type="button"
              onClick={handleDevBypass}
              disabled={isLoading}
              className="text-[11px] text-neutral-500 hover:text-[#FEEF8B] transition-colors underline underline-offset-4"
            >
              Demo Quick Access (Bypass for Testing)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#FEEF8B]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#F5C542]/5 rounded-full blur-[140px] pointer-events-none" />
      
      <Suspense fallback={
        <div className="flex items-center justify-center p-12 text-neutral-400 text-xs">
          <RefreshCw className="animate-spin mr-2" size={16} /> Loading SecureChain Auth...
        </div>
      }>
        <LoginContent />
      </Suspense>
    </div>
  );
}
