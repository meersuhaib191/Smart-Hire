"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Bell, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/hooks/useTheme';

type HeaderProps = {
  desktopCollapsed: boolean;
  onToggleDesktop: () => void;
  onToggleMobile: () => void;
};

export const Header = ({ desktopCollapsed, onToggleDesktop, onToggleMobile }: HeaderProps) => {
  const { user, logout } = useStore();
  const router = useRouter();
  const isHr = user?.role === 'hr';
  const isApplicant = user?.role === 'applicant';
  const [search, setSearch] = useState('');
  const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const loadNotifications = useCallback(async () => {
    if (!isApplicant && !isHr) return;
    try {
      const res = await fetch("/api/notifications?limit=1", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setUnreadCount(Number(json.unread || 0));
    } catch {
      // Non-blocking
    }
  }, [isApplicant, isHr]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadNotifications();
    }, 0);
    if (!isApplicant && !isHr) return () => window.clearTimeout(timeout);
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 15000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [isApplicant, isHr, loadNotifications]);

  useEffect(() => {
    if (!isHr) return;
    (async () => {
      const res = await fetch('/api/hr/jobs', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const nextJobs = (json.jobs || []).map((j: { id: string; title: string }) => ({ id: j.id, title: j.title }));
      setJobs(nextJobs);
      if (nextJobs.length) setSelectedJobId(nextJobs[0].id);
    })();
  }, [isHr]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const notificationRoute = useMemo(() => {
    if (isApplicant) return "/dashboard/applicant/notifications";
    if (isHr) return "/dashboard/hr/notifications";
    return "/dashboard";
  }, [isApplicant, isHr]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-sm dark:border-white/15 dark:bg-slate-950/65 dark:backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white lg:hidden" onClick={onToggleMobile}>
            <Menu size={18} />
          </Button>
          <Button variant="ghost" size="icon" className="hidden text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white lg:inline-flex" onClick={onToggleDesktop}>
            {desktopCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </Button>
          <div className="hidden items-center lg:flex">
            <Input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search candidates, jobs, skills..."
              leftIcon={<Search className="h-4 w-4 text-slate-500" />}
              className="h-10 w-[360px] max-w-[42vw] rounded-2xl border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-white/10 dark:text-white"
            />
          </div>
          {isHr ? (
            <div className="hidden lg:block">
              <Select
                value={selectedJobId}
                onValueChange={(id) => {
                  setSelectedJobId(id);
                  router.push(`/dashboard/hr/jobs/${id}/edit`);
                }}
              >
                <SelectTrigger className="ml-2 h-10 w-[240px] rounded-2xl border-slate-200 bg-white text-slate-800 dark:border-white/15 dark:bg-white/10 dark:text-slate-100">
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white" onClick={toggleTheme}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={() => router.push(notificationRoute)}
            title="Open notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 ? (
              <span className="absolute right-2 top-2 inline-flex h-2 w-2 rounded-full bg-violet-400 ring-2 ring-white dark:ring-slate-900" />
            ) : null}
          </Button>

          <div className="h-8 w-px bg-slate-200 dark:bg-white/15" />

          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.name || 'Guest'}</p>
            <p className="text-xs capitalize text-slate-500 dark:text-slate-300">{user?.role || 'visitor'}</p>
          </div>

          <img
            src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=1f2937&color=fff`}
            alt="Profile"
            className="h-8 w-8 rounded-full border border-slate-200 object-cover dark:border-white/20 sm:h-9 sm:w-9"
          />

          <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout" className="rounded-xl text-slate-600 hover:bg-slate-100 hover:text-rose-500 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-rose-300">
            <LogOut size={17} />
          </Button>
        </div>
      </div>
    </header>
  );
};
