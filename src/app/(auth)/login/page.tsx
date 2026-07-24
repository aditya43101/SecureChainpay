'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { auth, db } from '@/lib/firebase/client';
import { RecaptchaVerifier, signInWithPhoneNumber, GoogleAuthProvider, signInWithPopup, updateProfile, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

function LoginContent() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameValid, setUsernameValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [captchaSolved, setCaptchaSolved] = useState(false);
  
  // OTP States
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [otp, setOtp] = useState('');
  
  const router = useRouter();
  
  // Refs
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<any>(null);

  const cleanupRecaptcha = () => {
    if (verifierRef.current) {
      try { verifierRef.current.clear(); } catch {}
      verifierRef.current = null;
    }
    if ((window as any)?.recaptchaVerifier) {
      try { (window as any).recaptchaVerifier.clear(); } catch {}
      (window as any).recaptchaVerifier = null;
    }
    setCaptchaSolved(false);
  };

  const initRecaptcha = () => {
    // Clean up previous instance
    cleanupRecaptcha();
    
    if (!recaptchaContainerRef.current) return;
    
    // Clear old widget HTML
    recaptchaContainerRef.current.innerHTML = '';
    
    try {
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: 'normal',
        callback: () => {
          setCaptchaSolved(true);
          setError(null);
        },
        'expired-callback': () => {
          setCaptchaSolved(false);
          setError('Captcha expired. Please verify again.');
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

  // Initialize reCAPTCHA
  useEffect(() => {
    if (typeof window === 'undefined' || confirmationResult) return;
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initRecaptcha();
    }, 300);

    return () => {
      clearTimeout(timer);
      cleanupRecaptcha();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmationResult]);

  // Username uniqueness check
  const checkUsernameUnique = async (uname: string) => {
    if (!uname || uname.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      setUsernameValid(false);
      return false;
    }
    if (uname.length > 20) {
      setUsernameError('Username must be 20 characters or less');
      setUsernameValid(false);
      return false;
    }
    try {
      const docRef = doc(db, 'usernames', uname.toLowerCase());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUsernameError('This username is already taken. Please choose a unique one.');
        setUsernameValid(false);
        return false;
      }
      setUsernameError(null);
      setUsernameValid(true);
      return true;
    } catch (e: any) {
      console.error('Username check error:', e);
      // If Firestore permissions deny read, treat as available (first-time setup)
      if (e.code === 'permission-denied' || e.message?.includes('permission')) {
        setUsernameError('Missing Firestore rules. Please update your Firebase Security Rules.');
        setUsernameValid(false);
        return false;
      }
      setUsernameError(e.message || 'Error checking username availability');
      setUsernameValid(false);
      return false;
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
    setUsername(val);
    setUsernameValid(false);
    setUsernameError(null);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length > 0) {
      debounceRef.current = setTimeout(() => {
        checkUsernameUnique(val);
      }, 500);
    }
  };

  // Post-auth logic — save user data or validate existing account
  const handleAuthSuccess = async (user: any) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      let userDocSnap: any;
      
      try {
        userDocSnap = await getDoc(userDocRef);
      } catch (firestoreErr: any) {
        // If Firestore permissions deny, just proceed (first-time setup edge case)
        console.warn('Firestore read error, proceeding:', firestoreErr);
        router.push('/dashboard');
        return;
      }

      if (mode === 'register') {
        if (userDocSnap.exists()) {
          await signOut(auth);
          throw new Error('This account already exists. Please use Sign In instead.');
        }

        // Save username and user profile
        try {
          await setDoc(doc(db, 'usernames', username.toLowerCase()), { uid: user.uid });
        } catch {}
        
        try {
          await setDoc(userDocRef, {
            username,
            phoneNumber: user.phoneNumber || null,
            email: user.email || null,
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch {}
        
        try {
          await updateProfile(user, { displayName: username });
        } catch {}
        
      } else {
        // Login mode — check if user has registered
        if (!userDocSnap.exists()) {
          await signOut(auth);
          throw new Error('Account not found. Please register first to create an account.');
        }
      }
      
      router.push('/dashboard');
    } catch (err: any) {
      throw err;
    }
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    if (mode === 'register') {
      if (!username || username.length < 3) {
        setError('Please enter a username (min 3 characters) before signing up with Google.');
        return;
      }
      if (usernameError) {
        setError(usernameError);
        return;
      }
      // Do a final check
      const isUnique = await checkUsernameUnique(username);
      if (!isUnique) return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setSuccess('Google sign-in successful! Redirecting...');
      await handleAuthSuccess(result.user);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed. Please try again.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignore — just another popup trying to open
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
        setError('Please enter a username (minimum 3 characters).');
        return;
      }
      if (usernameError) {
        setError(usernameError);
        return;
      }
    }
    
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid phone number (e.g., +91XXXXXXXXXX).');
      return;
    }

    if (!captchaSolved) {
      setError('Please complete the captcha verification first.');
      return;
    }

    setIsLoading(true);
    
    try {
      const appVerifier = verifierRef.current || (window as any).recaptchaVerifier;
      if (!appVerifier) {
        throw new Error('Captcha not initialized. Please refresh the page.');
      }
      
      // Format phone: ensure it starts with +
      let formattedPhone = phone.trim();
      if (!formattedPhone.startsWith('+')) {
        // Default to India country code if no + prefix
        formattedPhone = '+91' + formattedPhone.replace(/\D/g, '');
      }
      
      const confResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confResult);
      setSuccess(`OTP sent to ${formattedPhone}! Check your SMS.`);
      setError(null);
      
      // Cleanup captcha since we don't need it anymore
      cleanupRecaptcha();
    } catch (err: any) {
      console.error('OTP send error:', err);
      
      if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number format. Use format: +91XXXXXXXXXX');
      } else if (err.code === 'auth/captcha-check-failed') {
        setError('Captcha verification failed. Please refresh and try again.');
        // Re-init captcha
        setTimeout(() => initRecaptcha(), 500);
      } else {
        setError(err.message || 'Failed to send OTP. Please try again.');
      }
      
      // Re-init captcha on any error
      setCaptchaSolved(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await confirmationResult.confirm(otp);
      setSuccess('OTP verified! Redirecting to dashboard...');
      await handleAuthSuccess(result.user);
    } catch (err: any) {
      console.error('OTP verify error:', err);
      if (err.code === 'auth/invalid-verification-code') {
        setError('Invalid OTP. Please check and try again.');
      } else if (err.code === 'auth/code-expired') {
        setError('OTP expired. Please go back and request a new one.');
      } else {
        setError(err.message || 'Verification failed. Please try again.');
      }
      setIsLoading(false);
    }
  };

  // Reset to phone entry screen
  const handleChangePhone = () => {
    setConfirmationResult(null);
    setOtp('');
    setError(null);
    setSuccess(null);
    setCaptchaSolved(false);
    // Re-init captcha after state update
    setTimeout(() => initRecaptcha(), 300);
  };

  // Can the form be submitted?
  const isPhoneFormValid = () => {
    if (mode === 'register') {
      return phone.replace(/\D/g, '').length >= 10 && captchaSolved && username.length >= 3 && !usernameError;
    }
    return phone.replace(/\D/g, '').length >= 10 && captchaSolved;
  };

  return (
    <div className="w-full relative animate-in fade-in zoom-in-95 duration-700 max-w-md mx-auto">
      
      {/* Premium Glass Card */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/10 p-8 sm:p-10 rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] relative overflow-hidden">
        
        {/* Subtle inner glow */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-8 space-y-4 relative z-10">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-[0_0_30px_rgba(52,211,153,0.3)] flex items-center justify-center transform hover:scale-105 transition-transform duration-500">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-950">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            SecureChain Pay
          </h1>
        </div>

        {confirmationResult ? (
          /* ============ OTP VERIFICATION VIEW ============ */
          <form onSubmit={handleVerifyOtp} className="space-y-4 relative z-10 animate-in fade-in slide-in-from-right-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-2">Verify your number</h2>
              <p className="text-neutral-400 text-sm">We sent an SMS with a 6-digit code to <span className="font-bold text-white">{phone}</span></p>
            </div>

            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-2.5 rounded-lg text-center animate-in fade-in">
                {success}
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                autoFocus
                className="w-full text-center tracking-[0.5em] font-mono px-4 py-4 bg-[#121212] border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all text-lg"
              />
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2.5 rounded-lg mt-2 text-center animate-in fade-in">
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.length < 6}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 text-neutral-950 font-bold text-base rounded-xl transition-all duration-200 shadow-[0_0_20px_rgba(52,211,153,0.2)] disabled:cursor-not-allowed mt-4"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-neutral-950/30 border-t-neutral-950 rounded-full animate-spin" />
              ) : (
                'Verify & Continue'
              )}
            </button>
            
            <button
              type="button"
              onClick={handleChangePhone}
              className="w-full text-neutral-400 hover:text-white text-sm mt-3 underline decoration-neutral-700 underline-offset-4 transition-colors"
            >
              ← Change phone number
            </button>
          </form>
        ) : (
          /* ============ LOGIN / REGISTER VIEW ============ */
          <>
            {/* Mode Toggle */}
            <div className="flex p-1 bg-black/40 rounded-xl mb-6 relative z-10 border border-white/5">
              <button 
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${mode === 'login' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => { setMode('register'); setError(null); setSuccess(null); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${mode === 'register' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              
              {/* Username field - ONLY for Register */}
              {mode === 'register' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder="Choose a unique username"
                    maxLength={20}
                    className={`w-full px-4 py-3.5 bg-[#121212] border ${
                      usernameError ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30' : 
                      usernameValid ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/30' :
                      'border-neutral-800 focus:border-neutral-600 focus:ring-neutral-600'
                    } rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-1 transition-all text-sm`}
                  />
                  {usernameError && (
                    <p className="text-red-400 text-xs px-1 animate-in fade-in">{usernameError}</p>
                  )}
                  {usernameValid && username.length >= 3 && (
                    <p className="text-emerald-400 text-xs px-1 animate-in fade-in">✓ Username is available</p>
                  )}
                </div>
              )}

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(null); }}
                  placeholder="+91 XXXXXXXXXX"
                  className="w-full px-4 py-3.5 bg-[#121212] border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition-all text-sm"
                />
              </div>

              {/* Error / Success Messages */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2.5 rounded-lg animate-in fade-in slide-in-from-top-2">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-2.5 rounded-lg animate-in fade-in">
                  {success}
                </div>
              )}

              {/* reCAPTCHA */}
              <div className="flex justify-center my-2">
                <div ref={recaptchaContainerRef} className="rounded-xl overflow-hidden shadow-lg border border-white/10"></div>
              </div>

              {/* Submit Button — ALWAYS CLICKABLE, validation happens in handleSubmit */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-2 py-4 px-6 font-bold text-base rounded-xl transition-all duration-200 shadow-sm ${
                  isPhoneFormValid() 
                    ? 'bg-white hover:bg-neutral-200 text-neutral-950 cursor-pointer' 
                    : 'bg-white/20 text-white/50 cursor-pointer hover:bg-white/30'
                } disabled:cursor-wait`}
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-neutral-950/30 border-t-neutral-950 rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
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
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0a0a0a] px-3 text-neutral-500">Or continue with</span>
              </div>
            </div>

            {/* Google Sign-In Button — ALWAYS CLICKABLE */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full relative z-10 flex items-center justify-center gap-3 py-4 px-6 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium rounded-xl transition-all duration-200 disabled:cursor-wait"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><span className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
