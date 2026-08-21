'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, RefreshCw, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { auth, db } from '@/lib/firebase/client';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  GoogleAuthProvider, 
  signInWithPopup, 
  updateProfile, 
  signOut,
  signInAnonymously,
  onAuthStateChanged,
  ConfirmationResult
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

function formatToE164(rawPhone: string): string {
  const trimmed = rawPhone.trim();
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.substring(1).replace(/\D/g, '');
  }
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return '+91' + digitsOnly;
  }
  return '+' + digitsOnly;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameValid, setUsernameValid] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [captchaSolved, setCaptchaSolved] = useState(false);
  
  // OTP States
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const router = useRouter();
  
  // Refs
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Auto-redirect if user already has an active authenticated session
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && isMountedRef.current) {
        localStorage.setItem('securechain_uid', user.uid);
        console.log('[SecureChain: Auth] Authenticated user detected on login page. Redirecting to dashboard...');
        router.push('/dashboard');
      }
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [router]);

  // Cooldown timer for resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const cleanupRecaptcha = () => {
    if (verifierRef.current) {
      try { 
        verifierRef.current.clear(); 
      } catch (e) {
        console.warn('Verifier clear warning:', e);
      }
      verifierRef.current = null;
    }
    if ((window as any)?.recaptchaVerifier) {
      try { 
        (window as any).recaptchaVerifier.clear(); 
      } catch (e) {
        console.warn('Window verifier clear warning:', e);
      }
      (window as any).recaptchaVerifier = null;
    }
    setCaptchaSolved(false);
  };

  const initRecaptcha = () => {
    cleanupRecaptcha();
    
    if (!recaptchaContainerRef.current) return;
    
    recaptchaContainerRef.current.innerHTML = '';
    
    try {
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: 'normal',
        callback: () => {
          if (isMountedRef.current) {
            setCaptchaSolved(true);
            setError(null);
          }
        },
        'expired-callback': () => {
          if (isMountedRef.current) {
            setCaptchaSolved(false);
            setError('Captcha expired. Please complete the verification again.');
          }
        }
      });
      
      verifierRef.current = verifier;
      (window as any).recaptchaVerifier = verifier;
      
      verifier.render().catch((err: any) => {
        console.error('reCAPTCHA render error:', err);
      });
    } catch (err) {
      console.error('reCAPTCHA init error:', err);
    }
  };

  // Re-init reCAPTCHA whenever mode changes or OTP state resets
  useEffect(() => {
    if (typeof window === 'undefined' || confirmationResult) return;
    
    const timer = setTimeout(() => {
      initRecaptcha();
    }, 250);

    return () => {
      clearTimeout(timer);
      cleanupRecaptcha();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmationResult, mode]);

  // Username uniqueness check
  const checkUsernameUnique = async (uname: string): Promise<boolean> => {
    const cleanUname = uname.trim().toLowerCase();
    if (!cleanUname || cleanUname.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      setUsernameValid(false);
      return false;
    }
    if (cleanUname.length > 20) {
      setUsernameError('Username must be 20 characters or less');
      setUsernameValid(false);
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUname)) {
      setUsernameError('Username can only contain letters, numbers, and underscores');
      setUsernameValid(false);
      return false;
    }

    setIsCheckingUsername(true);
    try {
      const docRef = doc(db, 'usernames', cleanUname);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUsernameError('This username is already taken. Please choose another.');
        setUsernameValid(false);
        return false;
      }
      setUsernameError(null);
      setUsernameValid(true);
      return true;
    } catch (e: any) {
      console.error('Username check error:', e);
      if (e.code === 'permission-denied' || e.message?.includes('permission')) {
        setUsernameError(null);
        setUsernameValid(true);
        return true;
      }
      setUsernameError(e.message || 'Error checking username availability');
      setUsernameValid(false);
      return false;
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
    // Authentication has succeeded and Firebase has supplied the UID. Start navigation
    // immediately; profile provisioning is non-critical and must not delay the dashboard.
    localStorage.setItem('securechain_uid', user.uid);
    router.push('/dashboard');

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
              phoneNumber: user.phoneNumber || null,
              email: user.email || null,
              role: 'USER',
              createdAt: new Date().toISOString()
            }, { merge: true });
          } catch (docErr) {
            console.warn('User profile auto-provision warning:', docErr);
          }
          if (mode === 'register') {
            try {
              await updateProfile(user, { displayName: normalizedUsername });
            } catch (profileErr) {
              console.warn('Firebase profile update warning:', profileErr);
            }
          }
        }
      } catch (err: any) {
        console.warn('Post-auth background tasks caught warning:', err);
      }
    })();
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    if (mode === 'register') {
      if (!username || username.length < 3) {
        setError('Please enter a username (min 3 characters) before signing up with Google.');
        return;
      }
      const isUnique = await checkUsernameUnique(username);
      if (!isUnique) return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      setSuccess('Google sign-in successful! Redirecting to dashboard...');
      await handleAuthSuccess(result.user, username || undefined);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed before completing. Please try again.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignored
      } else {
        setError(err.message || 'Failed to sign in with Google.');
      }
      setIsLoading(false);
    }
  };

  // Phone Number Submit → Send OTP
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (mode === 'register') {
      if (!username || username.length < 3) {
        setError('Please enter a valid username (minimum 3 characters).');
        return;
      }
      const isUnique = await checkUsernameUnique(username);
      if (!isUnique) {
        setError(usernameError || 'Please choose a different username.');
        return;
      }
    }
    
    const formattedPhone = formatToE164(phone);
    if (!formattedPhone || formattedPhone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid phone number with country code (e.g., +91XXXXXXXXXX).');
      return;
    }

    if (!captchaSolved) {
      setError('Please complete the reCAPTCHA verification before proceeding.');
      return;
    }

    setIsLoading(true);
    
    try {
      const appVerifier = verifierRef.current || (window as any).recaptchaVerifier;
      if (!appVerifier) {
        throw new Error('Captcha not initialized. Please refresh the page.');
      }
      
      const confResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confResult);
      setSuccess(`OTP sent to ${formattedPhone}! Check your SMS messages.`);
      setResendCooldown(30);
      setError(null);
      
      cleanupRecaptcha();
    } catch (err: any) {
      console.error('OTP send error:', err);
      
      if (err.code === 'auth/too-many-requests') {
        setError('Too many OTP attempts. Please wait a few minutes and try again.');
      } else if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number format. Please check country code and digits.');
      } else if (err.code === 'auth/captcha-check-failed') {
        setError('Captcha verification failed. Please try again.');
        setTimeout(() => initRecaptcha(), 400);
      } else {
        setError(err.message || 'Failed to send OTP. Please try again.');
      }
      
      setCaptchaSolved(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    
    if (!confirmationResult) {
      setError('Verification session expired. Please request a new OTP.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await confirmationResult.confirm(otp);
      setSuccess('OTP verified successfully! Initializing wallet...');
      await handleAuthSuccess(result.user, username || undefined);
    } catch (err: any) {
      console.error('OTP verify error:', err);
      if (err.code === 'auth/invalid-verification-code') {
        setError('Incorrect OTP code. Please check your SMS and try again.');
      } else if (err.code === 'auth/code-expired') {
        setError('OTP has expired. Please request a new code.');
      } else {
        setError(err.message || 'Verification failed. Please try again.');
      }
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setConfirmationResult(null);
    setOtp('');
    setError(null);
    setSuccess('Please complete captcha to resend OTP.');
    setCaptchaSolved(false);
    setTimeout(() => initRecaptcha(), 300);
  };

  // Reset to phone entry screen
  const handleChangePhone = () => {
    setConfirmationResult(null);
    setOtp('');
    setError(null);
    setSuccess(null);
    setCaptchaSolved(false);
    setTimeout(() => initRecaptcha(), 300);
  };

  // Dev Quick Login Bypass (functional test session)
  const handleDevBypass = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cred = await signInAnonymously(auth);
      const testUsername = `dev_user_${Math.floor(1000 + Math.random() * 9000)}`;
      await handleAuthSuccess(cred.user, testUsername);
    } catch (devErr: any) {
      console.error('Dev login bypass error:', devErr);
      setError('Dev login failed: ' + (devErr.message || 'Unknown error'));
      setIsLoading(false);
    }
  };

  const isPhoneFormValid = () => {
    const formatted = formatToE164(phone);
    const hasValidPhone = formatted.replace(/\D/g, '').length >= 10;
    if (mode === 'register') {
      return hasValidPhone && captchaSolved && username.length >= 3 && !usernameError && usernameValid;
    }
    return hasValidPhone && captchaSolved;
  };

  return (
    <div className="w-full relative animate-in fade-in zoom-in-95 duration-700 max-w-md mx-auto">
      
      {/* Premium Glass Card */}
      <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/10 p-8 sm:p-10 rounded-[2.5rem] shadow-[0_12px_40px_0_rgba(0,0,0,0.5)] relative overflow-hidden">
        
        {/* Subtle inner glow */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-8 space-y-3 relative z-10">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-[0_0_30px_rgba(52,211,153,0.3)] flex items-center justify-center transform hover:scale-105 transition-transform duration-500">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-950">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/70">
            SecureChain Pay
          </h1>
          <p className="text-xs text-neutral-400 font-medium">
            {confirmationResult ? 'Enter the security code' : (mode === 'login' ? 'Access your non-custodial crypto wallet' : 'Create your decentralized enterprise wallet')}
          </p>
        </div>

        {confirmationResult ? (
          /* ============ OTP VERIFICATION VIEW ============ */
          <form onSubmit={handleVerifyOtp} className="space-y-5 relative z-10 animate-in fade-in slide-in-from-right-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-white mb-1">Verify Phone Number</h2>
              <p className="text-neutral-400 text-xs">
                We sent a 6-digit verification code to <span className="font-semibold text-emerald-400">{formatToE164(phone)}</span>
              </p>
            </div>

            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3.5 py-3 rounded-xl text-center flex items-center justify-center gap-2 animate-in fade-in">
                <CheckCircle size={14} className="flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                maxLength={6}
                className="w-full text-center tracking-[0.6em] font-mono px-4 py-4 bg-[#121212] border border-neutral-800 rounded-2xl text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all text-2xl font-bold"
              />
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-3 rounded-xl mt-2 text-center flex items-center justify-center gap-2 animate-in fade-in">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.length < 6}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 text-neutral-950 font-bold text-base rounded-2xl transition-all duration-200 shadow-[0_0_25px_rgba(52,211,153,0.25)] disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-neutral-950/30 border-t-neutral-950 rounded-full animate-spin" />
              ) : (
                'Verify & Continue'
              )}
            </button>
            
            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={handleChangePhone}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                ← Change number
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
                className="text-emerald-400 hover:text-emerald-300 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        ) : (
          /* ============ LOGIN / REGISTER VIEW ============ */
          <>
            {/* Mode Toggle */}
            <div className="flex p-1 bg-black/50 rounded-2xl mb-6 relative z-10 border border-white/5">
              <button 
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${mode === 'login' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => { setMode('register'); setError(null); setSuccess(null); }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${mode === 'register' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              
              {/* Username field - ONLY for Register */}
              {mode === 'register' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Unique Username</label>
                    {isCheckingUsername && (
                      <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                        <RefreshCw size={10} className="animate-spin" /> Checking...
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder="e.g. aditya_singh"
                    maxLength={20}
                    className={`w-full px-4 py-3.5 bg-[#121212] border ${
                      usernameError ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30' : 
                      usernameValid ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/30' :
                      'border-neutral-800 focus:border-neutral-600 focus:ring-neutral-600'
                    } rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:ring-1 transition-all text-sm`}
                  />
                  {usernameError && (
                    <p className="text-red-400 text-xs px-1 animate-in fade-in flex items-center gap-1 mt-1">
                      <AlertCircle size={12} /> {usernameError}
                    </p>
                  )}
                  {usernameValid && username.length >= 3 && !usernameError && (
                    <p className="text-emerald-400 text-xs px-1 animate-in fade-in flex items-center gap-1 mt-1">
                      <CheckCircle size={12} /> Username is available
                    </p>
                  )}
                </div>
              )}

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Mobile Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(null); }}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-3.5 bg-[#121212] border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all text-sm font-mono"
                />
              </div>

              {/* Error / Success Messages */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-3 rounded-xl animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3.5 py-3 rounded-xl animate-in fade-in flex items-center gap-2">
                  <CheckCircle size={14} className="flex-shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {/* reCAPTCHA container */}
              <div className="flex justify-center my-3">
                <div ref={recaptchaContainerRef} className="rounded-xl overflow-hidden shadow-lg border border-white/10 min-h-[78px] flex items-center justify-center bg-black/20"></div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-2 py-4 px-6 font-bold text-base rounded-2xl transition-all duration-200 shadow-sm ${
                  isPhoneFormValid() 
                    ? 'bg-white hover:bg-neutral-200 text-neutral-950 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.15)]' 
                    : 'bg-white/10 text-white/40 cursor-pointer hover:bg-white/15'
                } disabled:cursor-wait`}
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-neutral-950/30 border-t-neutral-950 rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Send OTP Code' : 'Register & Send OTP'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6 z-10">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider">
                <span className="bg-[#0c0c0c] px-3 text-neutral-500 font-medium">Or continue with</span>
              </div>
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full relative z-10 flex items-center justify-center gap-3 py-3.5 px-6 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium rounded-2xl transition-all duration-200 disabled:cursor-wait hover:border-white/20"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
                </>
              )}
            </button>

            {/* DEV BYPASS BUTTON */}
            {process.env.NODE_ENV === 'development' && (
              <button
                type="button"
                onClick={handleDevBypass}
                disabled={isLoading}
                className="w-full mt-4 relative z-10 flex items-center justify-center gap-2 py-3 px-6 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 font-semibold rounded-2xl transition-all duration-200 text-xs"
              >
                <Sparkles size={14} /> Dev Mode Quick Login
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-[#050505]"><span className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
