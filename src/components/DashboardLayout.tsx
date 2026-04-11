"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './dashboard/Sidebar';
import { Header } from './dashboard/Header';
import { useStore } from '@/store/useStore';

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, hasCheckedSession, user } = useStore();
  const router = useRouter();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (hasCheckedSession && !isAuthenticated) {
      router.push('/login');
    }
  }, [hasCheckedSession, isAuthenticated, router]);

  if (!hasCheckedSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
        Restoring session...
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-100 to-indigo-50 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
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
