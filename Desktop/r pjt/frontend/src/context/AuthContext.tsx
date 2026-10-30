'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import {
  syncUserWithBackend,
  fetchMe,
  initializePassportApi,
  setOnboardingStatusApi,
  loginAsTestUserApi,
  logoutApi,
} from '../lib/api';
import { User, OnboardingStatus } from '../types/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithGoogleEmail: (email: string, name?: string) => Promise<void>;
  loginAsTestUser: (email: string) => Promise<void>;
  initializePassport: () => Promise<boolean>;
  completeOnboardingWithoutVehicle: () => Promise<boolean>;
  completeOnboardingWithVehicle: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  // Load existing session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('vehicle_passport_token');
    if (savedToken) {
      setToken(savedToken);
      fetchMe(savedToken)
        .then((res) => {
          if (res.success && res.data?.user) {
            setUser(res.data.user);
          } else {
            localStorage.removeItem('vehicle_passport_token');
            setToken(null);
            setUser(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('vehicle_passport_token');
          setToken(null);
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  // Protected route enforcement
  useEffect(() => {
    if (loading) return;

    const isProtected =
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/admin') ||
      pathname === '/initialize' ||
      pathname === '/onboarding';

    if (!user && isProtected) {
      // Unauthenticated user attempting protected route
      router.push('/login');
    } else if (user) {
      if (!user.isInitialized && pathname !== '/initialize') {
        // Authenticated but uninitialized user attempting other routes
        router.push('/initialize');
      } else if (
        user.isInitialized &&
        user.onboardingStatus === 'NOT_STARTED' &&
        pathname !== '/onboarding'
      ) {
        // Authenticated & initialized, but vehicle onboarding not yet completed
        router.push('/onboarding');
      } else if (
        user.isInitialized &&
        user.onboardingStatus &&
        user.onboardingStatus !== 'NOT_STARTED' &&
        (pathname === '/login' || pathname === '/initialize' || pathname === '/onboarding')
      ) {
        // Authenticated, initialized, and onboarding complete
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const determineTargetRoute = (targetUser: User): string => {
    if (!targetUser.isInitialized) {
      return '/initialize';
    }
    if (targetUser.onboardingStatus === 'NOT_STARTED') {
      return '/onboarding';
    }
    return '/dashboard';
  };

  const loginWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        throw new Error(
          'Firebase client credentials are not configured in .env.local. Please configure your Firebase Web API keys or select one of the Pre-Seeded Development Personas below to test.'
        );
      }

      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const idToken = await firebaseUser.getIdToken();

      const syncResult = await syncUserWithBackend(
        {
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Vehicle Owner',
          photoUrl: firebaseUser.photoURL,
        },
        idToken
      );

      if (syncResult.success && syncResult.data) {
        setUser(syncResult.data.user);
        setToken(syncResult.data.token);
        localStorage.setItem('vehicle_passport_token', syncResult.data.token);
        router.push(determineTargetRoute(syncResult.data.user));
      } else {
        throw new Error(syncResult.error || 'Failed to synchronize account with backend');
      }
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : 'Google sign-in failed';
      console.error('Google sign-in error:', err);
      if (typeof msg === 'string' && (msg.includes('auth/unauthorized-domain') || msg.includes('unauthorized domain'))) {
        msg = "Firebase domain not authorized: 'riya-project-five.vercel.app' needs to be added in Firebase Console > Authentication > Settings > Authorized domains. Alternatively, use Quick Google Sign-In below.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogleEmail = async (email: string, name?: string) => {
    setError(null);
    setLoading(true);
    try {
      const syncResult = await syncUserWithBackend({
        email: email.trim(),
        name: name?.trim() || email.split('@')[0],
        firebaseUid: `google-${Date.now()}`,
      });

      if (syncResult.success && syncResult.data) {
        setUser(syncResult.data.user);
        setToken(syncResult.data.token);
        localStorage.setItem('vehicle_passport_token', syncResult.data.token);
        router.push(determineTargetRoute(syncResult.data.user));
      } else {
        throw new Error(syncResult.error || 'Failed to authenticate user');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      console.error('Quick login error:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loginAsTestUser = async (email: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await loginAsTestUserApi(email);
      if (res.success && res.data) {
        setUser(res.data.user);
        setToken(res.data.token);
        localStorage.setItem('vehicle_passport_token', res.data.token);
        router.push(determineTargetRoute(res.data.user));
      } else {
        throw new Error(res.error || 'Failed to authenticate test user');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test persona authentication failed';
      console.error('Test user login error:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const initializePassport = async (): Promise<boolean> => {
    if (!token) return false;
    setError(null);
    try {
      const res = await initializePassportApi(token);
      if (res.success && res.data) {
        setUser(res.data.user);
        setToken(res.data.token);
        localStorage.setItem('vehicle_passport_token', res.data.token);
        // After blockchain identity initialization, direct user to onboarding vehicle choice!
        router.push('/onboarding');
        return true;
      } else {
        setError(res.error || 'Failed to initialize vehicle passport');
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Initialization failed';
      setError(msg);
      return false;
    }
  };

  const completeOnboardingWithoutVehicle = async (): Promise<boolean> => {
    if (!token) return false;
    setError(null);
    try {
      const res = await setOnboardingStatusApi(token, 'COMPLETED_WITHOUT_VEHICLE');
      if (res.success && res.data) {
        setUser(res.data.user);
        setToken(res.data.token);
        localStorage.setItem('vehicle_passport_token', res.data.token);
        router.push('/dashboard');
        return true;
      } else {
        setError(res.error || 'Failed to complete onboarding');
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Onboarding failed';
      setError(msg);
      return false;
    }
  };

  const completeOnboardingWithVehicle = async (): Promise<boolean> => {
    if (!token) return false;
    setError(null);
    try {
      const res = await setOnboardingStatusApi(token, 'COMPLETED_WITH_VEHICLE');
      if (res.success && res.data) {
        setUser(res.data.user);
        setToken(res.data.token);
        localStorage.setItem('vehicle_passport_token', res.data.token);
        return true;
      }
      return false;
    } catch (err: unknown) {
      return false;
    }
  };

  const logout = async () => {
    try {
      if (isFirebaseConfigured) {
        await signOut(auth);
      }
      await logoutApi(token);
    } catch (err) {
      console.warn('Signout warning:', err);
    } finally {
      localStorage.removeItem('vehicle_passport_token');
      setUser(null);
      setToken(null);
      router.push('/login');
    }
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await fetchMe(token);
      if (res.success && res.data?.user) {
        setUser(res.data.user);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        loginWithGoogle,
        loginWithGoogleEmail,
        loginAsTestUser,
        initializePassport,
        completeOnboardingWithoutVehicle,
        completeOnboardingWithVehicle,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
