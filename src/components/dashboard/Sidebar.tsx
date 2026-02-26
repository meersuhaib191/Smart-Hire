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
  FileText,
  Settings,
  Code,
  Video,
  BarChart,
  ShieldCheck,
  BrainCircuit
} from 'lucide-react';

interface SidebarItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const roleMenus: Record<UserRole, SidebarItem[]> = {
  applicant: [
    { icon: LayoutDashboard, label: 'Overview', href: '/dashboard/applicant' },
    { icon: FileText, label: 'My Applications', href: '/dashboard/applicant/applications' },
    { icon: Briefcase, label: 'Job Feed', href: '/jobs' }, // Public job feed
    { icon: Code, label: 'Practice', href: '/dashboard/applicant/practice' },
    { icon: Settings, label: 'Profile', href: '/dashboard/applicant/profile' },
  ],
  hr: [
    { icon: LayoutDashboard, label: 'Overview', href: '/dashboard/hr' },
    { icon: Briefcase, label: 'Jobs', href: '/dashboard/hr/jobs' },
    { icon: Users, label: 'Candidates', href: '/dashboard/hr/candidates' },
    { icon: BarChart, label: 'Analytics', href: '/dashboard/hr/analytics' },
    { icon: Settings, label: 'Settings', href: '/dashboard/hr/settings' },
  ],
  admin: [
    { icon: LayoutDashboard, label: 'Overview', href: '/dashboard/admin' },
    { icon: Users, label: 'Users', href: '/dashboard/admin/users' },
    { icon: Briefcase, label: 'Companies', href: '/dashboard/admin/companies' },
    { icon: ShieldCheck, label: 'Audit Logs', href: '/dashboard/admin/logs' },
    { icon: BrainCircuit, label: 'AI Models', href: '/dashboard/admin/ai' },
  ]
};

export const Sidebar = () => {
  const { user } = useStore();
  const role = user?.role || 'applicant';
  const menu = roleMenus[role];
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen fixed left-0 top-0 border-r border-slate-800 transition-all duration-300">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <div className="flex items-center gap-2 font-bold text-xl text-white">
          <div className="p-1 bg-indigo-600 rounded-lg text-white">
            <BrainCircuit size={20} />
          </div>
          SmartHire
        </div>
      </div>

      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Menu
        </div>
        {menu.map((item) => {
          const isActive = item.href === `/dashboard/${role}`
            ? pathname === item.href
            : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <img
            src={user?.avatar || "https://ui-avatars.com/api/?name=User&background=random"}
            alt="User"
            className="w-8 h-8 rounded-full bg-slate-700"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name || 'Guest'}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{user?.role || 'Visitor'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
