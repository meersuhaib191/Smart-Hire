"use client";
import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'success' | 'warning' | 'error';
}

export const Badge = ({ className, variant = 'primary', ...props }: BadgeProps) => {
  const variants = {
    primary: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/20 dark:text-indigo-200',
    secondary: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
    outline: 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200',
    success: 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-500/20 dark:text-green-200',
    warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-200',
    error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-indigo-400',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};
