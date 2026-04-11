"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { motion } from "motion/react";
import { ArrowRight, BriefcaseBusiness, Coins, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { SanitizedJob } from "@/components/jobs/types";
import { buildCompanyLogoLabel, formatSkillTags } from "@/components/jobs/job-utils";

type JobCardProps = {
  job: SanitizedJob;
  index: number;
};

export function JobCard({ job, index }: JobCardProps) {
  const skills = formatSkillTags(job.skills);

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.3), duration: 0.4 }}
      className="group rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-100 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:shadow-indigo-900/30"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-sm font-semibold text-white shadow-lg shadow-indigo-200">
            {buildCompanyLogoLabel(job.company)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{job.title}</p>
            <p className="truncate text-sm font-medium text-slate-600 dark:text-slate-300">{job.company}</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-200">
          Active hiring
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          {job.locationLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <BriefcaseBusiness className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          {job.typeLabel} / {job.experienceLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          {job.salaryLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {skill}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-300">
          <Sparkles className="h-3.5 w-3.5" />
          Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
        </span>
        <Link href={`/jobs/${job.id}`}>
          <Button className="rounded-xl transition group-hover:bg-indigo-600">
            View Details
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </motion.article>
  );
}
