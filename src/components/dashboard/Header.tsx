"use client";
import React from 'react';
import { useStore } from '@/store/useStore';
import { Bell, Menu, Search, PanelLeftClose, PanelLeftOpen, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from 'next/navigation';

type HeaderProps = {
  desktopCollapsed: boolean;
  onToggleDesktop: () => void;
  onToggleMobile: () => void;
};

export const Header = ({ desktopCollapsed, onToggleDesktop, onToggleMobile }: HeaderProps) => {
  const { user, logout, notifications } = useStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
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
          <Button variant="ghost" size="icon" className="relative rounded-xl">
            <Bell size={18} />
            {notifications > 0 ? (
              <span className="absolute right-2 top-2 inline-flex h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white" />
            ) : null}
          </Button>

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
