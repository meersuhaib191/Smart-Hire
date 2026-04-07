"use client";
import { create } from 'zustand';
import { supabase } from '@/utils/supabase/client';


export type UserRole = 'applicant' | 'hr' | 'admin';

const syncUserProfileOnServer = async (
  accessToken: string,
  payload: { userId: string; email: string; role: UserRole; name: string }
) => {
  const response = await fetch('/api/auth/sync-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || 'Failed to sync user profile.');
  }
};

const toUserFriendlyAuthError = (message?: string) => {
  const normalized = (message || "").toLowerCase();
  if (normalized.includes("email rate limit exceeded")) {
    return "Too many signup attempts. Please wait 60 seconds and try again.";
  }
  if (normalized.includes("invalid api key")) {
    return "Supabase API key is invalid. Please verify .env.local keys.";
  }
  if (normalized.includes("fetch failed")) {
    return "Could not reach Supabase. Check network and Supabase URL configuration.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox (and spam), then try logging in again.";
  }
  return message || "Authentication failed.";
};

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  company?: string;
}

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  notifications: number;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role: UserRole, name: string) => Promise<void>;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
  checkSession: () => Promise<void>;
}



export const useStore = create<AppState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  notifications: 3,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const loginBody = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok) {
        throw new Error(toUserFriendlyAuthError(loginBody?.error || 'Failed to sign in'));
      }

      const session = loginBody?.data?.session;
      const user = session?.user;
      if (!user || !session?.access_token) {
        throw new Error('No session returned. If email confirmation is required, confirm your email first.');
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (sessionError) {
        throw new Error(toUserFriendlyAuthError(sessionError.message));
      }

      const appRole = (user.user_metadata.role as UserRole) || 'applicant';
      await syncUserProfileOnServer(session.access_token, {
        userId: user.id,
        email: user.email!,
        role: appRole,
        name: user.user_metadata.name || 'User'
      });

      set({
        isAuthenticated: true,
        user: {
          id: user.id,
          email: user.email!,
          name: user.user_metadata.name || 'User',
          role: appRole,
          avatar: user.user_metadata.avatar,
          company: user.user_metadata.company
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        throw new Error(toUserFriendlyAuthError(error.message));
      }
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, role, name) => {
    set({ isLoading: true });
    try {
      const registerRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, name })
      });
      const registerBody = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok) {
        throw new Error(toUserFriendlyAuthError(registerBody?.error || 'Failed to register user'));
      }
      const data = registerBody?.data;

      const createdAuthUser = data.user ?? data.session?.user;
      if (!createdAuthUser) {
        throw new Error('Account created but no auth user was returned by Supabase.');
      }

      if (!data.session) {
        throw new Error(
          "Account created. Please confirm your email first, then sign in."
        );
      }

      if (data.session?.access_token && data.session.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionError) {
          console.error('setSession after register:', sessionError);
        }
      }

      if (data.session?.access_token) {
        await syncUserProfileOnServer(data.session.access_token, {
          userId: createdAuthUser.id,
          email,
          role,
          name
        });
      }

      if (data.session) {
        const user = data.session.user;
        set({
          isAuthenticated: true,
          user: {
            id: user.id,
            email: user.email!,
            name: user.user_metadata.name,
            role: user.user_metadata.role,
            avatar: user.user_metadata.avatar
          }
        });
      }
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  checkSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const user = session.user;
      const appRole = (user.user_metadata.role as UserRole) || 'applicant';
      await syncUserProfileOnServer(session.access_token, {
        userId: user.id,
        email: user.email!,
        role: appRole,
        name: user.user_metadata.name || 'User'
      });

      set({
        isAuthenticated: true,
        user: {
          id: user.id,
          email: user.email!,
          name: user.user_metadata.name || 'User',
          role: appRole,
          avatar: user.user_metadata.avatar,
          company: user.user_metadata.company
        }
      });
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),
  updateUser: (updates) => set((state) => ({
    user: state.user ? { ...state.user, ...updates } : null
  })),
}));
