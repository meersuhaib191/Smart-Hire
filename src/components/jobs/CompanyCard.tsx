"use client";

import Link from "next/link";
import { Building2, ExternalLink, Globe, Rocket, Users } from "lucide-react";
import { buildCompanyLogoLabel } from "@/components/jobs/job-utils";

type CompanyCardProps = {
  company: string;
  industry: string;
  website: string;
  jobsPosted: number;
  hiringActivity: string;
};

export function CompanyCard({ company, industry, website, jobsPosted, hiringActivity }: CompanyCardProps) {
  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-sm font-semibold text-white">
          {buildCompanyLogoLabel(company)}
        </div>
        <div>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{company}</p>
          <p className="text-sm text-slate-500 dark:text-slate-300">Company credibility</p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {company} builds modern hiring and productivity systems for high-growth teams with a strong engineering culture.
      </p>

      <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          Industry: {industry}
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          Jobs posted: {jobsPosted}
        </div>
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          Hiring activity: {hiringActivity}
        </div>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <Link href={website} target="_blank" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200">
            Visit website
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
