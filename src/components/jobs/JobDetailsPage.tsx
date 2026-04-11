"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Bookmark, CircleUserRound, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { CompanyCard } from "@/components/jobs/CompanyCard";
import { formatSkillTags, sanitizeJob, splitDescription } from "@/components/jobs/job-utils";
import type { PublicJob } from "@/components/jobs/types";

type JobPayload = {
  job?: PublicJob;
};

export function JobDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as JobPayload;
        if (response.ok && data.job) {
          setJob(data.job);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const sanitized = useMemo(() => (job ? sanitizeJob(job) : null), [job]);
  const sections = useMemo(() => splitDescription(sanitized?.description || ""), [sanitized]);
  const skillTags = useMemo(() => formatSkillTags(sanitized?.skills || []), [sanitized]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="h-8 w-2/3 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-5/6 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="h-72 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  if (!sanitized) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-3xl flex-col items-center justify-center px-4 text-center">
        <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Job not found</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">This role may have been filled or removed.</p>
        <Link href="/jobs" className="mt-5">
          <Button className="rounded-xl">Back to Jobs</Button>
        </Link>
      </div>
    );
  }

  const recruiter = {
    name: "Nadia Hassan",
    role: "Senior Talent Partner",
    profile: "https://linkedin.com",
  };

  return (
    <div>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to roles
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-sm font-medium text-indigo-600">{sanitized.company}</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900 dark:text-slate-100">{sanitized.title}</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                {skillTags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-6 text-sm leading-7 text-slate-600 dark:text-slate-300">{sections.summary}</p>
            </section>

            <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Responsibilities</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {sections.responsibilities.map((item) => (
                  <li key={item} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Requirements</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {sections.requirements.map((item) => (
                  <li key={item} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <CompanyCard
              company={sanitized.company}
              industry="SaaS / HR Tech"
              website="https://www.smarthire.ai"
              jobsPosted={12}
              hiringActivity="Interviewing weekly"
            />

            <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recruiter</h2>
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center gap-3">
                  <CircleUserRound className="h-9 w-9 text-indigo-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{recruiter.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">{recruiter.role}</p>
                  </div>
                </div>
                <Link href={recruiter.profile} target="_blank" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200">
                  View profile
                </Link>
              </div>
            </section>
          </motion.div>

          <aside className="h-fit lg:sticky lg:top-24">
            <div className="space-y-3 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <Link href={`/jobs/${sanitized.id}/apply`} className="block">
                <Button className="w-full rounded-xl hover:bg-indigo-600">
                  <Send className="mr-2 h-4 w-4" />
                  Apply Now
                </Button>
              </Link>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => toast.success("Job saved to your shortlist.")}>
                <Bookmark className="mr-2 h-4 w-4" />
                Save Job
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    toast.success("Share link copied.");
                  } catch {
                    toast.error("Unable to copy link.");
                  }
                }}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share Job
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
