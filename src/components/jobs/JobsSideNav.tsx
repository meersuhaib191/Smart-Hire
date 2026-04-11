"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bookmark, BriefcaseBusiness, BrainCircuit, ClipboardCheck, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/store/useStore";

const items = [
  { href: "/jobs", label: "All Jobs", icon: BriefcaseBusiness },
  { href: "/dashboard/applicant/applications", label: "My Applications", icon: ClipboardCheck },
  { href: "/dashboard/applicant/applications", label: "Saved Jobs", icon: Bookmark },
  { href: "/dashboard/applicant/applications", label: "Job Alerts", icon: Bell },
];

export function JobsSideNav() {
  const pathname = usePathname();
  const { user, isAuthenticated, hasCheckedSession, logout } = useStore();
  const isSignedIn = hasCheckedSession && isAuthenticated && Boolean(user?.id);
  const dashboardHref = user?.role === "hr" || user?.role === "admin" ? "/hr/dashboard" : "/applicant/dashboard";

  return (
    <aside className="hidden md:sticky md:top-20 md:block md:h-[calc(100vh-6rem)] md:w-full md:overflow-hidden md:rounded-3xl md:border md:border-white/15 md:bg-gradient-to-b md:from-slate-950 md:via-slate-900 md:to-slate-950 md:p-4 md:text-slate-100 md:shadow-2xl">
      <Link href="/" className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-white">
        <div className="rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 p-1.5 text-white">
          <BrainCircuit className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">SmartHire</span>
      </Link>

      {isSignedIn ? (
        <div className="mb-4 space-y-2">
          <Link href={dashboardHref} className="block">
            <Button variant="outline" size="sm" className="w-full justify-start rounded-xl border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-start rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"
            onClick={() => {
              void logout();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      ) : null}

      <p className="px-2 pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Navigation</p>
      <nav className="space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-gradient-to-r from-violet-500/80 to-indigo-500/80 text-white shadow-lg"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
