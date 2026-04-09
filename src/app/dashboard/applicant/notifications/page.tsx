"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, ClipboardCheck, Code2, MessageSquareText, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  route?: string | null;
  type?: string | null;
  is_read: boolean;
  created_at: string;
};

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
  if (value === "mcq") return <ClipboardCheck size={16} className="text-indigo-600" />;
  if (value === "coding") return <Code2 size={16} className="text-violet-600" />;
  if (value === "interview") return <MessageSquareText size={16} className="text-sky-600" />;
  return <BellRing size={16} className="text-slate-600" />;
};

export default function ApplicantNotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [mode, setMode] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "mcq" | "coding" | "interview" | "info">("all");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "30");
      if (mode === "unread") params.set("unread", "1");
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setItems(Array.isArray(json.items) ? json.items : []);
      setUnreadTotal(Number(json.unread || 0));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode, typeFilter]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void load(true);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  const markAllRead = async () => {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    if (!res.ok) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadTotal(0);
  };

  const markOneRead = async (id: string) => {
    const target = items.find((n) => n.id === id);
    if (!target || target.is_read) return;
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadTotal((prev) => Math.max(0, prev - 1));
  };

  const emptyTitle = useMemo(() => {
    if (mode === "unread") return "No unread notifications";
    if (typeFilter !== "all") return `No ${typeFilter.toUpperCase()} notifications`;
    return "No notifications yet";
  }, [mode, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">Updates about your pipeline rounds, stage changes, and next actions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="primary" className="rounded-full">{unreadTotal} unread</Badge>
          <Button variant="outline" size="sm" onClick={() => void load(true)} className="rounded-lg" isLoading={refreshing}>
            {!refreshing ? <RefreshCw size={14} className="mr-1.5" /> : null}
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unreadTotal === 0} className="rounded-lg">
            Mark all read
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-slate-200/80 bg-white/95 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "all" ? "primary" : "outline"}
              className="rounded-full px-4"
              onClick={() => setMode("all")}
            >
              All
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "unread" ? "primary" : "outline"}
              className="rounded-full px-4"
              onClick={() => setMode("unread")}
            >
              Unread
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "mcq", "coding", "interview", "info"] as const).map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={typeFilter === t ? "secondary" : "ghost"}
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setTypeFilter(t)}
              >
                {t === "all" ? "All Types" : t.toUpperCase()}
              </Button>
            ))}
          </div>
          <CardDescription>
            Click any notification to open the related page and mark it read.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title={emptyTitle}
              description="You will see notifications here when HR advances your application."
              icon={<BellRing size={18} />}
            />
          ) : (
            <div className="space-y-3">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-xl border p-4 transition ${
                    n.is_read ? "border-slate-200 bg-white" : "border-indigo-100 bg-indigo-50/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                        {iconForType(n.type)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{n.title}</p>
                          {!n.is_read ? <span className="inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" /> : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                        <p className="mt-1 text-xs text-slate-400">{formatWhen(n.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link href={n.route || "/dashboard/applicant/applications"}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() => {
                            void markOneRead(n.id);
                          }}
                        >
                          Open
                        </Button>
                      </Link>
                      {!n.is_read ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg"
                          onClick={() => {
                            void markOneRead(n.id);
                          }}
                        >
                          Mark read
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
