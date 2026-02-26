"use client";
import React from 'react';
import { useStore } from '@/store/useStore';
import { Bell, Search, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from 'next/navigation';

export const Header = () => {
  const { user, logout, notifications } = useStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm ml-64">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Input 
            type="text" 
            placeholder="Search..." 
            leftIcon={<Search className="h-4 w-4 text-slate-400" />} 
            className="w-full h-9 bg-slate-50 border-slate-200 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-indigo-600">
          <Bell size={20} />
          {notifications > 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          )}
        </Button>
        
        <div className="h-8 w-px bg-slate-200 mx-2"></div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
            <LogOut size={18} className="text-slate-500 hover:text-red-600" />
          </Button>
        </div>
      </div>
    </header>
  );
};
