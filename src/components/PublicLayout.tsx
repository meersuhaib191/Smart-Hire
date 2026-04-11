"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/Button';
import { BrainCircuit, Menu } from 'lucide-react';
import { useStore } from '@/store/useStore';

export const PublicLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const { user, isAuthenticated, hasCheckedSession, logout } = useStore();
  const isSignedIn = hasCheckedSession && isAuthenticated && Boolean(user?.id);
  const dashboardHref =
    user?.role === 'hr' || user?.role === 'admin' ? '/hr/dashboard' : '/applicant/dashboard';
  const getStartedHref = isSignedIn ? dashboardHref : '/login';
  const isJobsRoute = pathname?.startsWith('/jobs');

  return (
    <div className="app-shell min-h-screen flex flex-col">
      {!isJobsRoute ? (
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-slate-900 dark:text-white">
            <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
              <BrainCircuit size={20} />
            </div>
            SmartHire
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Link href="/features" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">Features</Link>
            <Link href="/pricing" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">Pricing</Link>
            <Link href="/jobs" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">Jobs</Link>
          </nav>

          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <>
                <Link href={dashboardHref}>
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void logout();
                  }}
                >
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Link href={getStartedHref}>
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu size={20} />
            </Button>
          </div>
        </div>
      </header>
      ) : null}

      <main className="flex-1">
        {children}
      </main>

      {!isJobsRoute ? (
      <footer className="border-t border-slate-200/80 bg-white py-6 text-sm text-slate-600 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-300">
        <div className="container mx-auto flex items-center justify-center gap-2 px-4 text-center">
          <BrainCircuit size={16} className="text-indigo-600" />
          <span>SmartHire - The intelligent hiring operating system for modern teams.</span>
        </div>
        <div className="container mx-auto mt-4 border-t border-slate-100 px-4 pt-4 text-center text-slate-400">
          © 2024 Smart Hire Inc. All rights reserved.
        </div>
      </footer>
      ) : null}
    </div>
  );
};
