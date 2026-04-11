"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type JobRow = {
  id: string;
  title: string;
  status?: string | null;
  shortlist_status?: string | null;
  shortlist_selected_count?: number | null;
  shortlist_total_submissions?: number | null;
  applications?: Array<{ id: string }>;
};

export default function HrAnalyticsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/hr/jobs", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setJobs((json.jobs || []) as JobRow[]);
    })();
  }, []);

  const totals = useMemo(() => {
    const totalJobs = jobs.length;
    const totalApplicants = jobs.reduce(
      (sum, job) => sum + (Array.isArray(job.applications) ? job.applications.length : 0),
      0
    );
    const completedShortlists = jobs.filter(
      (job) => String(job.shortlist_status || "").toLowerCase() === "completed"
    ).length;
    const pendingShortlists = jobs.filter((job) =>
      ["pending", "running", "failed", ""].includes(String(job.shortlist_status || "").toLowerCase())
    ).length;
    return { totalJobs, totalApplicants, completedShortlists, pendingShortlists };
  }, [jobs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            End-to-end hiring metrics from job posting to automatic shortlist completion.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/hr/candidates">
            <Button variant="outline">Open Candidates</Button>
          </Link>
          <Link href="/dashboard/hr/pipeline">
            <Button>Open Pipeline</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="rounded-2xl border-slate-200/80">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Jobs</p>
            <p className="text-2xl font-semibold text-slate-900">{totals.totalJobs}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Applicants</p>
            <p className="text-2xl font-semibold text-slate-900">{totals.totalApplicants}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Shortlists Completed</p>
            <p className="text-2xl font-semibold text-slate-900">{totals.completedShortlists}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Shortlists Pending</p>
            <p className="text-2xl font-semibold text-slate-900">{totals.pendingShortlists}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-slate-200/80">
        <CardHeader>
          <CardTitle>Job Automation Status</CardTitle>
          <CardDescription>Track ATS and shortlist execution status per job.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{job.title}</p>
                <div className="flex gap-2">
                  <Badge variant="secondary">{job.status || "draft"}</Badge>
                  <Badge variant="outline">shortlist: {job.shortlist_status || "pending"}</Badge>
                </div>
              </div>
            </div>
          ))}
          {!jobs.length ? <p className="text-sm text-slate-500">No jobs available for analytics.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
