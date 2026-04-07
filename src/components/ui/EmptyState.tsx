"use client";

import { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm ${className}`}>
      {icon ? <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">{icon}</div> : null}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
