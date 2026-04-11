"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type JobRow = {
  id: string;
  title: string;
  status?: string | null;
  submission_deadline_at?: string | null;
  shortlist_status?: string | null;
  shortlist_selected_count?: number | null;
  shortlist_total_submissions?: number | null;
  applications?: Array<{ id: string }>;
};

export default function HrJobsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/hr/jobs", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error || "Failed to load jobs.");
          setJobs([]);
          return;
        }
        setJobs((json.jobs || []) as JobRow[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const publishedCount = useMemo(
    () => jobs.filter((j) => String(j.status || "").toUpperCase() === "PUBLISHED").length,
    [jobs]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Jobs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage posted roles, monitor shortlist status, and track submission volume.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/jobs">
            <Button variant="outline">Explore Platform Jobs</Button>
          </Link>
          <Link href="/dashboard/hr/jobs/new">
            <Button>Create Job</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-2xl border-slate-200/80">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Jobs</p>
            <p className="text-2xl font-semibold text-slate-900">{jobs.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Published</p>
            <p className="text-2xl font-semibold text-slate-900">{publishedCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Applications</p>
            <p className="text-2xl font-semibold text-slate-900">
              {jobs.reduce((sum, job) => sum + (Array.isArray(job.applications) ? job.applications.length : 0), 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-slate-200/80">
        <CardHeader>
          <CardTitle>Posted Jobs</CardTitle>
          <CardDescription>Deadline and shortlist lifecycle for each role.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!loading && error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!loading && !jobs.length ? (
            <EmptyState
              title="No jobs posted yet"
              description="Create your first role to start receiving applications."
              action={
                <Link href="/dashboard/hr/jobs/new">
                  <Button>Create Job</Button>
                </Link>
              }
            />
          ) : null}
          {jobs.map((job) => (
            <div key={job.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{job.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{job.status || "draft"}</Badge>
                  <Badge variant="outline">shortlist: {job.shortlist_status || "pending"}</Badge>
                  <Badge variant="outline">
                    apps: {Array.isArray(job.applications) ? job.applications.length : 0}
                  </Badge>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <p>
                  Deadline:{" "}
                  {job.submission_deadline_at
                    ? new Date(job.submission_deadline_at).toLocaleString()
                    : "Not set"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/dashboard/hr/jobs/${job.id}/edit`}>
                    <Button size="sm" variant="outline" className="rounded-lg">
                      Edit Job
                    </Button>
                  </Link>
                  <Link href="/dashboard/hr/pipeline">
                    <Button size="sm" variant="outline" className="rounded-lg">
                      Open Pipeline
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
