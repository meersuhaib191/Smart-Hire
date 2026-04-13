"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { FilterSidebar } from "@/components/jobs/FilterSidebar";
import { JobCard } from "@/components/jobs/JobCard";
import { sanitizeJob } from "@/components/jobs/job-utils";
import type { JobFilters, PublicJob } from "@/components/jobs/types";
import { useStore } from "@/store/useStore";

const initialFilters: JobFilters = {
  query: "",
  location: "",
  types: [],
  levels: [],
  salaryMin: 0,
  salaryMax: 300,
};

export function JobListingPage() {
  const { user } = useStore();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<JobFilters>(initialFilters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/jobs", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as { jobs?: PublicJob[] };
        if (response.ok) {
          setJobs(payload.jobs || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sanitizedJobs = useMemo(() => jobs.map(sanitizeJob), [jobs]);

  const filteredJobs = useMemo(() => {
    return sanitizedJobs.filter((job) => {
      const query = filters.query.trim().toLowerCase();
      const location = filters.location.trim().toLowerCase();
      const matchesQuery =
        !query ||
        job.title.toLowerCase().includes(query) ||
        job.company.toLowerCase().includes(query) ||
        job.skills.some((skill) => skill.toLowerCase().includes(query));

      const matchesLocation = !location || job.locationLabel.toLowerCase().includes(location);
      const matchesType = filters.types.length === 0 || filters.types.includes(job.typeLabel);
      const matchesLevel = filters.levels.length === 0 || filters.levels.includes(job.experienceLabel);
      const salaryValue = extractSalaryValue(job.salaryLabel);
      const matchesSalary = salaryValue >= filters.salaryMin && salaryValue <= filters.salaryMax;
      return matchesQuery && matchesLocation && matchesType && matchesLevel && matchesSalary;
    });
  }, [filters, sanitizedJobs]);

  return (
    <div className="app-shell min-h-screen">
      <Sidebar
        role={user?.role || "applicant"}
        desktopCollapsed={desktopCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div
        className={`min-h-screen transition-all duration-300 ${
          desktopCollapsed ? "lg:pl-[5.25rem]" : "lg:pl-[16.5rem]"
        }`}
      >
        <Header
          desktopCollapsed={desktopCollapsed}
          onToggleDesktop={() => setDesktopCollapsed((prev) => !prev)}
          onToggleMobile={() => setMobileOpen((prev) => !prev)}
        />
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="app-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500">SmartHire Jobs</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Jobs</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-300">
              Explore open roles, compare opportunities quickly, and apply through a guided hiring flow.
            </p>
          </motion.div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
            <div className="hidden lg:block">
              <FilterSidebar
                filters={filters}
                onToggleType={(type) =>
                  setFilters((prev) => ({
                    ...prev,
                    types: prev.types.includes(type) ? prev.types.filter((item) => item !== type) : [...prev.types, type],
                  }))
                }
                onToggleLevel={(level) =>
                  setFilters((prev) => ({
                    ...prev,
                    levels: prev.levels.includes(level) ? prev.levels.filter((item) => item !== level) : [...prev.levels, level],
                  }))
                }
                onSalaryChange={([salaryMin, salaryMax]) => setFilters((prev) => ({ ...prev, salaryMin, salaryMax }))}
                onLocationChange={(location) => setFilters((prev) => ({ ...prev, location }))}
                onReset={() => setFilters(initialFilters)}
              />
            </div>

            <div className="space-y-4">
              <div className="app-card p-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(true)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                  </button>
                  <label className="relative block flex-1">
                    <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={filters.query}
                      onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
                      placeholder="Search roles, skills, or company..."
                      className="w-full rounded-xl border border-slate-200 px-10 py-2.5 text-sm text-slate-700 outline-none ring-indigo-200 transition focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>
                </div>
              </div>

              {loading ? (
                <ListingSkeleton />
              ) : filteredJobs.length === 0 ? (
                <div className="app-card p-10 text-center">
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">No roles match your filters</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Adjust filters or broaden your search to discover more openings.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredJobs.map((job, index) => (
                    <JobCard key={job.id} job={job} index={index} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 p-4 lg:hidden">
          <div className="mx-auto max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filter jobs</p>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <FilterSidebar
              filters={filters}
              onToggleType={(type) =>
                setFilters((prev) => ({
                  ...prev,
                  types: prev.types.includes(type) ? prev.types.filter((item) => item !== type) : [...prev.types, type],
                }))
              }
              onToggleLevel={(level) =>
                setFilters((prev) => ({
                  ...prev,
                  levels: prev.levels.includes(level) ? prev.levels.filter((item) => item !== level) : [...prev.levels, level],
                }))
              }
              onSalaryChange={([salaryMin, salaryMax]) => setFilters((prev) => ({ ...prev, salaryMin, salaryMax }))}
              onLocationChange={(location) => setFilters((prev) => ({ ...prev, location }))}
              onReset={() => setFilters(initialFilters)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ListingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-6 w-1/2 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-3 h-4 w-1/3 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-5 h-4 w-full animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-2 h-4 w-5/6 animate-pulse rounded-lg bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

function extractSalaryValue(label: string) {
  const match = label.match(/(\d{2,3})/);
  return match ? Number(match[1]) : 120;
}
