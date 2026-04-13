"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore, UserRole } from '@/store/useStore';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  ClipboardCheck,
  Bell,
  BarChart,
  Settings,
  X,
  Sparkles,
  Brain,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { motion } from 'motion/react';

interface SidebarItem {
  id: string;
  icon: React.ElementType;
  label: string;
  href: string;
}

const roleMenus: Record<UserRole, SidebarItem[]> = {
  applicant: [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', href: '/applicant/dashboard' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs', href: '/jobs' },
    { id: 'applications', icon: Users, label: 'My Applications', href: '/dashboard/applicant/applications' },
    { id: 'notifications', icon: Bell, label: 'Notifications', href: '/dashboard/applicant/notifications' },
    { id: 'practice', icon: Sparkles, label: 'Practice', href: '/dashboard/applicant/practice' },
    { id: 'settings', icon: Settings, label: 'Profile', href: '/applicant/profile' },
  ],
  hr: [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard/hr' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs', href: '/dashboard/hr/jobs' },
    { id: 'candidates', icon: Users, label: 'Candidates', href: '/dashboard/hr/candidates' },
    { id: 'notifications', icon: Bell, label: 'Notifications', href: '/dashboard/hr/notifications' },
    { id: 'analytics', icon: BarChart, label: 'Analytics', href: '/dashboard/hr/analytics' },
    { id: 'settings', icon: Settings, label: 'Settings', href: '/dashboard/hr/settings' },
  ],
  admin: [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard/admin' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs', href: '/dashboard/admin/companies' },
    { id: 'candidates', icon: Users, label: 'Candidates', href: '/dashboard/admin/users' },
    { id: 'assessments', icon: ClipboardCheck, label: 'Assessments', href: '/dashboard/admin/logs' },
    { id: 'analytics', icon: BarChart, label: 'Analytics', href: '/dashboard/admin/ai' },
    { id: 'settings', icon: Settings, label: 'Settings', href: '/dashboard/admin/ai' },
  ],
};

type SidebarProps = {
  role: UserRole;
  desktopCollapsed: boolean;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export const Sidebar = ({ role, desktopCollapsed, mobileOpen, setMobileOpen }: SidebarProps) => {
  const { user } = useStore();
  const menu = roleMenus[role];
  const pathname = usePathname();
  const requiresProfile = (role === 'applicant' || role === 'hr') && !user?.isProfileComplete;
  const profileHref = role === 'hr' ? '/hr/complete-profile' : '/applicant/complete-profile';

  const sidebarWidth = desktopCollapsed ? 'w-[5.25rem]' : 'w-[16.5rem]';

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-slate-200 bg-white text-slate-800 shadow-lg backdrop-blur transition-all duration-300 dark:border-white/20 dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100 dark:shadow-2xl lg:shadow-none',
          sidebarWidth,
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-16 flex items-center justify-between border-b border-slate-200 px-4 dark:border-white/10">
          <div className={cn('flex items-center gap-3 overflow-hidden', desktopCollapsed && 'lg:justify-center lg:gap-0')}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-lg">
              <Brain size={18} />
            </div>
            <div className={cn('min-w-0', desktopCollapsed && 'lg:hidden')}>
              <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-white">SmartHire</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-300">AI Hiring Workspace</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </Button>
        </div>

        <div className={cn('px-3 pt-4', desktopCollapsed && 'lg:px-2')}>
          <div className={cn('rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/15 dark:bg-white/5 dark:backdrop-blur', desktopCollapsed && 'lg:hidden')}>
            <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-violet-200">
              <Sparkles size={14} />
              AI Hiring Assistant
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              ATS-first screening, ranking, and automation in one place.
            </p>
          </div>
        </div>

        <div className={cn('flex-1 space-y-1 overflow-y-auto px-3 py-6', desktopCollapsed && 'lg:px-2')}>
          {requiresProfile ? (
            <Link
              href={profileHref}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'mb-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100',
                desktopCollapsed && 'lg:justify-center lg:px-2'
              )}
            >
              <UserCheck size={18} className="shrink-0" />
              <span className={cn('truncate', desktopCollapsed && 'lg:hidden')}>Complete your profile</span>
            </Link>
          ) : null}
          <div
            className={cn(
              'px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400',
              desktopCollapsed && 'lg:text-center lg:px-0'
            )}
          >
            Navigation
          </div>
          {menu.map((item) => {
            const isRootDashboardItem = item.id === 'dashboard';
            const isActive = isRootDashboardItem
              ? pathname === item.href
              : pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <motion.div key={`${role}-${item.id}`} whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}>
                <Link
                key={`${role}-${item.id}`}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all',
                  desktopCollapsed && 'lg:justify-center lg:px-2',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm dark:bg-gradient-to-r dark:from-violet-500/80 dark:to-indigo-500/80 dark:text-white dark:shadow-lg'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                )}
              >
                <item.icon
                  size={18}
                  className={cn('shrink-0', isActive ? 'text-indigo-600 dark:text-white' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white')}
                />
                <span className={cn('truncate', desktopCollapsed && 'lg:hidden')}>{item.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className={cn('border-t border-slate-200 p-3 dark:border-white/10', desktopCollapsed && 'lg:px-2')}>
          <div className={cn('flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-white/15 dark:bg-white/5', desktopCollapsed && 'lg:justify-center')}>
            <img
              src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=111827&color=fff`}
              alt="User avatar"
              className="h-8 w-8 rounded-full object-cover"
            />
            <div className={cn('min-w-0 flex-1', desktopCollapsed && 'lg:hidden')}>
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{user?.name || 'Guest'}</p>
              <p className="truncate text-xs capitalize text-slate-500 dark:text-slate-400">{user?.role || 'visitor'}</p>
            </div>
            <div className={cn('rounded-md bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300', desktopCollapsed && 'lg:hidden')}>
              <ShieldCheck size={11} className="inline mr-1" />
              Live
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
