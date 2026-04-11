"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Bell, Briefcase, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'motion/react';
import { useTheme } from 'next-themes';

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
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    }>
  >([]);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const formatWhen = (iso: string) => {
    const then = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const loadNotifications = async () => {
    if (!isApplicant && !isHr) return;
    try {
      setNotificationsLoading(true);
      const res = await fetch("/api/notifications?limit=6", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setUnreadCount(Number(json.unread || 0));
      setNotifications(Array.isArray(json.items) ? json.items : []);
    } catch {
      // Non-blocking
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
    if (!isApplicant && !isHr) return;
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [isApplicant, isHr]);

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

  const notificationLabel = useMemo(() => {
    if (notificationsLoading) return 'Loading...';
    if (!notifications.length) return 'No updates yet.';
    return `${notifications.length} recent event${notifications.length > 1 ? 's' : ''}`;
  }, [notifications.length, notificationsLoading]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/15 bg-slate-950/65 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="text-slate-200 hover:bg-white/10 hover:text-white lg:hidden" onClick={onToggleMobile}>
            <Menu size={18} />
          </Button>
          <Button variant="ghost" size="icon" className="hidden text-slate-200 hover:bg-white/10 hover:text-white lg:inline-flex" onClick={onToggleDesktop}>
            {desktopCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </Button>
          <div className="hidden items-center lg:flex">
            <Input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search candidates, jobs, skills..."
              leftIcon={<Search className="h-4 w-4 text-slate-500" />}
              className="h-10 w-[360px] max-w-[42vw] rounded-2xl border-white/15 bg-white/10 text-sm text-white placeholder:text-slate-400"
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
                <SelectTrigger className="ml-2 h-10 w-[240px] rounded-2xl border-white/15 bg-white/10 text-slate-100">
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
          <Button variant="ghost" size="icon" className="rounded-xl text-slate-200 hover:bg-white/10 hover:text-white" onClick={toggleTheme}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-xl text-slate-200 hover:bg-white/10 hover:text-white">
                <Bell size={18} />
                {unreadCount > 0 ? (
                  <span className="absolute right-2 top-2 inline-flex h-2 w-2 rounded-full bg-violet-400 ring-2 ring-slate-900" />
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px] rounded-2xl border border-slate-200/70 p-0">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <DropdownMenuLabel className="p-0 text-sm font-semibold text-slate-900">Activity Alerts</DropdownMenuLabel>
                <Badge variant="secondary" className="rounded-full">
                  {unreadCount} unread
                </Badge>
              </div>
              <div className="px-4 py-3 text-xs text-slate-500">{notificationLabel}</div>
              <DropdownMenuSeparator />
              <div className="max-h-80 overflow-y-auto p-2">
                {notifications.slice(0, 6).map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-2 rounded-xl border p-3 ${item.is_read ? 'border-slate-100 bg-white' : 'border-violet-100 bg-violet-50'}`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.message}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatWhen(item.created_at)}</p>
                  </motion.div>
                ))}
                {!notifications.length && !notificationsLoading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                    No events to show.
                  </div>
                ) : null}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-8 w-px bg-white/15" />

          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-white">{user?.name || 'Guest'}</p>
            <p className="text-xs capitalize text-slate-300">{user?.role || 'visitor'}</p>
          </div>

          <img
            src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=1f2937&color=fff`}
            alt="Profile"
            className="h-8 w-8 rounded-full border border-white/20 object-cover sm:h-9 sm:w-9"
          />

          <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout" className="rounded-xl text-slate-200 hover:bg-white/10 hover:text-rose-300">
            <LogOut size={17} />
          </Button>
        </div>
      </div>
    </header>
  );
};
