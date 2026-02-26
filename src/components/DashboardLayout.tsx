"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './dashboard/Sidebar';
import { Header } from './dashboard/Header';
import { useStore } from '@/store/useStore';

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 transition-all duration-300">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
