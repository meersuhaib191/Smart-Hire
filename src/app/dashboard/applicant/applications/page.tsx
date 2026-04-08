"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoadingSkeleton } from "@/components/ui/PageLoadingSkeleton";

type AppRow = {
  id: string;
  pipeline_step: string;
  current_stage: string;
  applied_at: string;
  jobs: { title: string } | null;
};

export default function Page() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/applicant/applications", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setRows(json.applications || []);
          setErrorMessage("");
        } else {
          setRows([]);
          setErrorMessage(json.error || "Failed to load applications.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">My Applications</h1>
          <p className="mt-1 text-sm text-slate-500">Track each stage across ATS, MCQ, coding, and interview.</p>
        </div>
        <Link href="/jobs">
          <Button className="rounded-lg">Explore Jobs</Button>
        </Link>
      </div>
      {!loading && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      {loading ? <PageLoadingSkeleton /> : null}
      {!loading ? (
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle>Active Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.length === 0 ? (
              <EmptyState
                title="No applications yet."
                description="Apply to a job and your progress appears here."
              />
            ) : null}
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50/70">
                <div>
                  <p className="font-medium text-slate-900">{r.jobs?.title || "Job"}</p>
                  <p className="text-xs text-slate-500">
                    Stage: {r.pipeline_step} · Status: {r.current_stage}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{r.pipeline_step}</Badge>
                  <Link href={`/dashboard/applicant/applications/${r.id}`}>
                    <Button size="sm" variant="outline" className="rounded-lg">
                      Open
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}