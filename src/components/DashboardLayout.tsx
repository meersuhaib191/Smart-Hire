"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './dashboard/Sidebar';
import { Header } from './dashboard/Header';
import { useStore } from '@/store/useStore';

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useStore();
  const router = useRouter();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        role={user?.role || 'applicant'}
        desktopCollapsed={desktopCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div
        className={`min-h-screen transition-all duration-300 ${
          desktopCollapsed ? 'lg:pl-[5.25rem]' : 'lg:pl-[16.5rem]'
        }`}
      >
        <Header
          desktopCollapsed={desktopCollapsed}
          onToggleDesktop={() => setDesktopCollapsed((prev) => !prev)}
          onToggleMobile={() => setMobileOpen((prev) => !prev)}
        />
        <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
};
