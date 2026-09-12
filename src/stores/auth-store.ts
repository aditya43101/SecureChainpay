import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  displayName?: string;
  username?: string;
  email?: string;
  phoneNumber?: string;
  accountTier?: string;
  role: 'admin' | 'user';
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  updateUser: (fields: Partial<User>) => void;
  login: (user: User) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  updateUser: (fields) => set((state) => ({ user: state.user ? { ...state.user, ...fields } : null })),
  login: (user) => set({ user, isAuthenticated: true, error: null }),
  logout: () => set({ user: null, isAuthenticated: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
