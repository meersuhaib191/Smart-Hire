"use client";
import { create } from 'zustand';
import { supabase } from '@/utils/supabase/client';


export type UserRole = 'applicant' | 'hr' | 'admin';

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      const user = data.session?.user;
      if (user) {
        set({
          isAuthenticated: true,
          user: {
            id: user.id,
            email: user.email!,
            name: user.user_metadata.name || 'User',
            role: user.user_metadata.role || 'applicant',
            avatar: user.user_metadata.avatar,
            company: user.user_metadata.company
          }
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, role, name) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            name,
          },
        },
      });

      if (error) throw error;

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
      set({
        isAuthenticated: true,
        user: {
          id: user.id,
          email: user.email!,
          name: user.user_metadata.name || 'User',
          role: user.user_metadata.role || 'applicant',
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
