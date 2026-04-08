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
  BarChart,
  Settings,
  Sparkles,
  X,
  BrainCircuit,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
    { id: 'applications', icon: ClipboardCheck, label: 'My Applications', href: '/dashboard/applicant/applications' },
    { id: 'practice', icon: ClipboardCheck, label: 'Practice', href: '/dashboard/applicant/practice' },
    { id: 'settings', icon: Settings, label: 'Profile', href: '/applicant/profile' },
  ],
  hr: [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', href: '/hr/dashboard' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs', href: '/dashboard/hr/jobs' },
    { id: 'candidates', icon: Users, label: 'Candidates', href: '/dashboard/applicants' },
    { id: 'pipeline', icon: ClipboardCheck, label: 'Pipeline', href: '/dashboard/applicants' },
    { id: 'analytics', icon: BarChart, label: 'Analytics', href: '/dashboard/hr/analytics' },
    { id: 'settings', icon: Settings, label: 'Profile', href: '/hr/profile' },
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
          'fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-slate-200/80 bg-white/95 shadow-xl backdrop-blur-xl transition-all duration-300 lg:shadow-none',
          sidebarWidth,
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-16 flex items-center justify-between border-b border-slate-200/80 px-4">
          <div className={cn('flex items-center gap-3 overflow-hidden', desktopCollapsed && 'lg:justify-center lg:gap-0')}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
              <BrainCircuit size={18} />
            </div>
            <div className={cn('min-w-0', desktopCollapsed && 'lg:hidden')}>
              <p className="truncate text-sm font-semibold tracking-tight text-slate-900">Smart Hire AI</p>
              <p className="text-[11px] text-slate-500">Hiring Operating System</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </Button>
        </div>

        <div className={cn('px-3 pt-4', desktopCollapsed && 'lg:px-2')}>
          <div className={cn('rounded-xl border border-indigo-100 bg-indigo-50/80 p-3', desktopCollapsed && 'lg:hidden')}>
            <div className="flex items-center gap-2 text-xs font-medium text-indigo-700">
              <Sparkles size={14} />
              AI Hiring Assistant
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-indigo-600">
              Track pipeline progress and candidate quality in real-time.
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
              'px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400',
              desktopCollapsed && 'lg:text-center lg:px-0'
            )}
          >
            Workspace
          </div>
          {menu.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={`${role}-${item.id}`}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  desktopCollapsed && 'lg:justify-center lg:px-2',
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <item.icon
                  size={18}
                  className={cn('shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-900')}
                />
                <span className={cn('truncate', desktopCollapsed && 'lg:hidden')}>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className={cn('border-t border-slate-200/80 p-3', desktopCollapsed && 'lg:px-2')}>
          <div className={cn('flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5', desktopCollapsed && 'lg:justify-center')}>
            <img
              src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=111827&color=fff`}
              alt="User avatar"
              className="h-8 w-8 rounded-full object-cover"
            />
            <div className={cn('min-w-0 flex-1', desktopCollapsed && 'lg:hidden')}>
              <p className="truncate text-sm font-medium text-slate-900">{user?.name || 'Guest'}</p>
              <p className="truncate text-xs capitalize text-slate-500">{user?.role || 'visitor'}</p>
            </div>
            <div className={cn('rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500', desktopCollapsed && 'lg:hidden')}>
              Pro
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
