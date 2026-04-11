"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

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
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-white/40 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
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
        <Card className="rounded-2xl border-white/40 bg-white/80 dark:border-white/10 dark:bg-slate-900/70">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Total Jobs</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{totals.totalJobs}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/40 bg-white/80 dark:border-white/10 dark:bg-slate-900/70">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Total Applicants</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{totals.totalApplicants}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/40 bg-white/80 dark:border-white/10 dark:bg-slate-900/70">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Shortlists Completed</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{totals.completedShortlists}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/40 bg-white/80 dark:border-white/10 dark:bg-slate-900/70">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Shortlists Pending</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{totals.pendingShortlists}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-white/40 bg-white/80 dark:border-white/10 dark:bg-slate-900/70">
        <CardHeader>
          <CardTitle className="dark:text-white">Automation Trend</CardTitle>
          <CardDescription className="dark:text-slate-300">Completed vs pending shortlists per role.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={jobs.map((job) => ({
                  name: job.title.length > 16 ? `${job.title.slice(0, 16)}...` : job.title,
                  applicants: Array.isArray(job.applications) ? job.applications.length : 0,
                  shortlisted: Number(job.shortlist_selected_count || 0),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="applicants" fill="#6366f1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="shortlisted" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/40 bg-white/80 dark:border-white/10 dark:bg-slate-900/70">
        <CardHeader>
          <CardTitle className="dark:text-white">Job Automation Status</CardTitle>
          <CardDescription className="dark:text-slate-300">Track ATS and shortlist execution status per job.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.map((job) => (
            <motion.div
              key={job.id}
              whileHover={{ y: -2 }}
              className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900 dark:text-white">{job.title}</p>
                <div className="flex gap-2">
                  <Badge variant="secondary">{job.status || "draft"}</Badge>
                  <Badge variant="outline">shortlist: {job.shortlist_status || "pending"}</Badge>
                </div>
              </div>
            </motion.div>
          ))}
          {!jobs.length ? <p className="text-sm text-slate-500">No jobs available for analytics.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
