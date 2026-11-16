import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch, setApiAuthToken } from '../lib/api';
import type { AuthUser, UserProfileData } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  profile: UserProfileData | null;
  unreadNotifications: number;
  loading: boolean;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiFetch<{
        user: AuthUser;
        profile: UserProfileData | null;
        unreadNotifications: number;
      }>('/api/auth/me');
      setUser(data.user);
      setProfile(data.profile);
      setUnreadNotifications(data.unreadNotifications || 0);
    } catch {
      // Ignore if unauthenticated
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setApiAuthToken(idToken);
          await apiFetch('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ idToken }),
          });
          await refreshSession();
        } catch (err) {
          console.error('Auth sync error:', err);
        }
      } else if (!user) {
        setApiAuthToken(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [refreshSession]);

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    setApiAuthToken(idToken);
    await apiFetch('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    await refreshSession();
    setAuthModalOpen(false);
  };

  const loginWithEmail = async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setApiAuthToken(res.token);
    await refreshSession();
    setAuthModalOpen(false);
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setApiAuthToken(res.token);
    await refreshSession();
    setAuthModalOpen(false);
  };

  const logout = async () => {
    setApiAuthToken(null);
    setUser(null);
    setProfile(null);
    setUnreadNotifications(0);
    try {
      await signOut(auth);
    } catch {
      // ignore if local session only
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        unreadNotifications,
        loading,
        authModalOpen,
        setAuthModalOpen,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
