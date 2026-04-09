"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Bell, BellRing, ClipboardCheck, Code2, LogOut, Menu, MessageSquareText, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';

type HeaderProps = {
  desktopCollapsed: boolean;
  onToggleDesktop: () => void;
  onToggleMobile: () => void;
};

export const Header = ({ desktopCollapsed, onToggleDesktop, onToggleMobile }: HeaderProps) => {
  const { user, logout } = useStore();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    route?: string | null;
    type?: string | null;
    is_read: boolean;
    created_at: string;
  }>>([]);
  const isApplicant = useMemo(() => user?.role === "applicant", [user?.role]);
  const hasBootstrappedRef = useRef(false);
  const lastUnreadRef = useRef(0);

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

  const iconForType = (type?: string | null) => {
    const value = String(type || "").toLowerCase();
    if (value === "mcq") return <ClipboardCheck size={14} className="text-indigo-600" />;
    if (value === "coding") return <Code2 size={14} className="text-violet-600" />;
    if (value === "interview") return <MessageSquareText size={14} className="text-sky-600" />;
    return <BellRing size={14} className="text-slate-500" />;
  };

  const loadNotifications = async () => {
    if (!isApplicant) return;
    try {
      setNotificationsLoading(true);
      const res = await fetch("/api/notifications?limit=6", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const nextUnread = Number(json.unread || 0);
      if (hasBootstrappedRef.current && nextUnread > lastUnreadRef.current) {
        const delta = nextUnread - lastUnreadRef.current;
        toast.success(`You have ${delta} new notification${delta > 1 ? "s" : ""}.`);
      }
      setUnreadCount(nextUnread);
      lastUnreadRef.current = nextUnread;
      hasBootstrappedRef.current = true;
      setNotifications(Array.isArray(json.items) ? json.items : []);
    } catch {
      // Non-blocking for header rendering.
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
    if (!isApplicant) return;
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 12000);
    return () => window.clearInterval(interval);
  }, [isApplicant]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const markAllRead = async () => {
    if (!isApplicant || unreadCount === 0) return;
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    if (!res.ok) return;
    setUnreadCount(0);
    lastUnreadRef.current = 0;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markOneRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.is_read) return;
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    lastUnreadRef.current = Math.max(0, lastUnreadRef.current - 1);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onToggleMobile}>
            <Menu size={18} />
          </Button>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggleDesktop}>
            {desktopCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </Button>
          <div className="hidden items-center lg:flex">
            <Input
              type="text"
              placeholder="Search jobs, candidates, assessments..."
              leftIcon={<Search className="h-4 w-4 text-slate-400" />}
              className="h-10 w-[420px] max-w-[44vw] rounded-xl border-slate-200 bg-slate-50/80 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-xl">
                <Bell size={18} />
                {unreadCount > 0 ? (
                  <span className="absolute right-2 top-2 inline-flex h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white" />
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[420px] rounded-2xl p-0">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <DropdownMenuLabel className="p-0 text-sm font-semibold text-slate-900">Notifications</DropdownMenuLabel>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 ? (
                    <Badge variant="primary" className="rounded-full">
                      {unreadCount} new
                    </Badge>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 rounded-lg px-2 text-[11px]"
                    onClick={() => {
                      void markAllRead();
                    }}
                    disabled={unreadCount === 0}
                  >
                    Mark all read
                  </Button>
                </div>
              </div>
              <DropdownMenuSeparator className="my-0" />
              <div className="max-h-96 overflow-y-auto p-2">
                {!isApplicant ? (
                  <div className="px-2 py-8 text-center text-sm text-slate-500">
                    Notifications are currently enabled for applicant workflows.
                  </div>
                ) : notificationsLoading ? (
                  <div className="space-y-2 p-1">
                    <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-2 py-8 text-center text-sm text-slate-500">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      asChild
                      className={`block cursor-pointer rounded-xl border p-0 ${
                        n.is_read ? "border-slate-100 bg-white" : "border-indigo-100 bg-indigo-50/40"
                      }`}
                    >
                      <Link
                        href={n.route || "/dashboard/applicant/applications"}
                        onClick={() => {
                          void markOneRead(n.id);
                        }}
                        className="block p-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                            {iconForType(n.type)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-900">{n.title}</p>
                              {!n.is_read ? (
                                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-slate-600">{n.message}</p>
                            <p className="mt-1 text-[11px] text-slate-400">{formatWhen(n.created_at)}</p>
                          </div>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
              {isApplicant ? (
                <>
                  <DropdownMenuSeparator className="my-0" />
                  <div className="p-2">
                    <Link href="/dashboard/applicant/notifications" className="block">
                      <Button variant="outline" size="sm" className="h-8 w-full rounded-lg text-xs">
                        View all notifications
                      </Button>
                    </Link>
                  </div>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-8 w-px bg-slate-200" />

          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-900">{user?.name || 'Guest'}</p>
            <p className="text-xs capitalize text-slate-500">{user?.role || 'visitor'}</p>
          </div>

          <img
            src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=1f2937&color=fff`}
            alt="Profile"
            className="h-8 w-8 rounded-full border border-slate-200 object-cover sm:h-9 sm:w-9"
          />

          <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout" className="rounded-xl">
            <LogOut size={17} className="text-slate-500 hover:text-rose-600" />
          </Button>
        </div>
      </div>
    </header>
  );
};
