"use client";

import { SlidersHorizontal } from "lucide-react";
import type { JobFilters } from "@/components/jobs/types";

type FilterSidebarProps = {
  filters: JobFilters;
  onToggleType: (type: string) => void;
  onToggleLevel: (level: string) => void;
  onSalaryChange: (next: [number, number]) => void;
  onLocationChange: (location: string) => void;
  onReset: () => void;
};

const jobTypes = ["Full-time", "Part-time", "Contract", "Internship"];
const levels = ["Entry", "Mid", "Senior", "Lead"];

export function FilterSidebar({
  filters,
  onToggleType,
  onToggleLevel,
  onSalaryChange,
  onLocationChange,
  onReset,
}: FilterSidebarProps) {
  return (
    <aside className="h-fit space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 lg:sticky lg:top-24">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
          Filters
        </p>
        <button onClick={onReset} className="text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
          Reset
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Job Type</p>
        {jobTypes.map((type) => (
          <label key={type} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={filters.types.includes(type)}
              onChange={() => onToggleType(type)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            {type}
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Experience</p>
        {levels.map((level) => (
          <label key={level} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={filters.levels.includes(level)}
              onChange={() => onToggleLevel(level)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            {level}
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Salary Range (k/year)</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            max={500}
            value={filters.salaryMin}
            onChange={(event) => onSalaryChange([Number(event.target.value) || 0, filters.salaryMax])}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <input
            type="number"
            min={filters.salaryMin}
            max={600}
            value={filters.salaryMax}
            onChange={(event) => onSalaryChange([filters.salaryMin, Number(event.target.value) || filters.salaryMin])}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Location</p>
        <input
          type="text"
          value={filters.location}
          onChange={(event) => onLocationChange(event.target.value)}
          placeholder="Remote, London, Bangalore..."
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>
    </aside>
  );
}
