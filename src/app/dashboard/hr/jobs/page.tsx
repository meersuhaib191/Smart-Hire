"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
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

const getCurrentRoundLabel = (job: JobRow) => {
  const shortlistStatus = String(job.shortlist_status || "").toLowerCase();
  if (shortlistStatus === "completed") return "MCQ Round Ongoing";
  if (shortlistStatus === "failed") return "Deadline Shortlist Needs Attention";

  const deadline = job.submission_deadline_at ? new Date(job.submission_deadline_at).getTime() : null;
  if (deadline && deadline <= Date.now()) return "Awaiting Deadline Shortlist";
  return "Collecting Applications";
};

const getJobLifecycleLabel = (job: JobRow) => {
  const status = String(job.status || "").toUpperCase();
  if (status === "PUBLISHED") return "Hiring Active";
  if (status === "CLOSED") return "Hiring Closed";
  return "Draft";
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
      <div className="app-card flex flex-wrap items-start justify-between gap-3 p-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Jobs</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Manage posted roles, monitor current round progress, and track submission volume.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/jobs">
            <Button variant="outline">Explore Jobs</Button>
          </Link>
          <Link href="/dashboard/hr/jobs/new">
            <Button>Create Job</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Total Jobs</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{jobs.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Published</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{publishedCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Total Applications</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">
              {jobs.reduce((sum, job) => sum + (Array.isArray(job.applications) ? job.applications.length : 0), 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="dark:text-white">Posted Jobs</CardTitle>
          <CardDescription className="dark:text-slate-300">Feature-rich job cards with lifecycle, round status, and quick actions.</CardDescription>
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
            <motion.div key={job.id} whileHover={{ y: -2 }} className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{job.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    Deadline: {job.submission_deadline_at ? new Date(job.submission_deadline_at).toLocaleString() : "Not set"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{getJobLifecycleLabel(job)}</Badge>
                  <Badge variant="outline">{getCurrentRoundLabel(job)}</Badge>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                <p className="rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
                  Applications: {Array.isArray(job.applications) ? job.applications.length : 0}
                </p>
                <p className="rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
                  Shortlisted: {Number(job.shortlist_selected_count || 0)}
                </p>
                <p className="rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
                  Submissions: {Number(job.shortlist_total_submissions || 0)}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
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
                <Link href="/dashboard/hr/candidates">
                  <Button size="sm" variant="outline" className="rounded-lg">
                    Open Candidates
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
