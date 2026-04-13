"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import { BellRing, CalendarClock, CircleAlert, Sparkles, Target, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { chartTheme } from '@/theme/chart';

type JobRow = {
  id: string;
  title: string;
  status: string;
  submission_deadline_at?: string | null;
  shortlist_status?: string | null;
  shortlist_selected_count?: number | null;
  shortlist_total_submissions?: number | null;
  applications?: Array<{ id: string }>;
};

type Candidate = {
  applicationId: string;
  email: string;
  pipelineStep: string;
  atsScore: number | null;
  rankPosition: number | null;
  skills?: string[];
};

type AnalyticsPayload = {
  job: {
    submissionDeadlineAt: string | null;
    shortlistStatus: string | null;
    shortlistSelectedCount: number;
    shortlistTotalSubmissions: number;
  } | null;
  candidates: Candidate[];
};

type SummaryPayload = {
  activeJobs: number;
  totalApplicants: number;
  interviewingCount: number;
  completionRate: number;
  dailyApplicants: Array<{ name: string; applicants: number }>;
};

const STAGES = [
  { key: 'ATS', label: 'ATS' },
  { key: 'MCQ', label: 'MCQ' },
  { key: 'CODING', label: 'Coding' },
  { key: 'INTERVIEW', label: 'AI Interview' },
  { key: 'SELECTED', label: 'Selected' },
] as const;

type StageKey = (typeof STAGES)[number]['key'];

const stageToLabel: Record<StageKey, string> = {
  ATS: 'ATS',
  MCQ: 'MCQ',
  CODING: 'Coding',
  INTERVIEW: 'AI Interview',
  SELECTED: 'Selected',
};

function normalizeStage(step: string): StageKey {
  const normalized = String(step || '').toUpperCase();
  if (normalized.includes('MCQ')) return 'MCQ';
  if (normalized.includes('CODING')) return 'CODING';
  if (normalized.includes('INTERVIEW')) return 'INTERVIEW';
  if (normalized.includes('SELECTED') || normalized.includes('HIRED') || normalized.includes('COMPLETE')) return 'SELECTED';
  return 'ATS';
}

function countdown(deadlineIso?: string | null): string {
  if (!deadlineIso) return 'No deadline configured';
  const ms = new Date(deadlineIso).getTime() - Date.now();
  if (ms <= 0) return 'Deadline passed';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
}

const resolveCurrentRound = (candidates: Candidate[]) => {
  const counts = { ATS: 0, MCQ: 0, CODING: 0, INTERVIEW: 0, SELECTED: 0 };
  for (const candidate of candidates) {
    counts[normalizeStage(candidate.pipelineStep)] += 1;
  }

  if (counts.INTERVIEW > 0) return { label: 'AI Interview Round Ongoing', variant: 'secondary' as const };
  if (counts.CODING > 0) return { label: 'Coding Round Ongoing', variant: 'secondary' as const };
  if (counts.MCQ > 0) return { label: 'MCQ Round Ongoing', variant: 'success' as const };
  if (counts.ATS > 0) return { label: 'Awaiting Deadline Shortlist', variant: 'secondary' as const };
  return { label: 'Round Not Started', variant: 'outline' as const };
};

export const HRDashboard = () => {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [jobsRes, summaryRes] = await Promise.all([
          fetch('/api/hr/jobs', { cache: 'no-store' }),
          fetch('/api/hr/summary', { cache: 'no-store' }),
        ]);
        const jobsJson = await jobsRes.json().catch(() => ({}));
        const summaryJson = await summaryRes.json().catch(() => ({}));
        const nextJobs = (jobsJson.jobs || []) as JobRow[];
        setJobs(nextJobs);
        if (nextJobs.length) setSelectedJobId(nextJobs[0].id);
        if (summaryRes.ok) {
          setSummary({
            activeJobs: Number(summaryJson.activeJobs || 0),
            totalApplicants: Number(summaryJson.totalApplicants || 0),
            interviewingCount: Number(summaryJson.interviewingCount || 0),
            completionRate: Number(summaryJson.completionRate || 0),
            dailyApplicants: (summaryJson.dailyApplicants || []) as Array<{ name: string; applicants: number }>,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;
    (async () => {
      const res = await fetch(`/api/hr/jobs/${selectedJobId}/analytics`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setAnalytics({
          job: json.job || null,
          candidates: (json.candidates || []) as Candidate[],
        });
      }
    })();
  }, [selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;
    const id = window.setInterval(() => {
      setClockTick((prev) => prev + 1);
      void (async () => {
        const res = await fetch(`/api/hr/jobs/${selectedJobId}/analytics`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setAnalytics({
            job: json.job || null,
            candidates: (json.candidates || []) as Candidate[],
          });
        }
      })();
    }, 20000);
    return () => window.clearInterval(id);
  }, [selectedJobId]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) || null, [jobs, selectedJobId]);
  const candidates = useMemo(() => analytics?.candidates ?? [], [analytics?.candidates]);
  const filteredCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.email.toLowerCase().includes(query.trim().toLowerCase())),
    [candidates, query]
  );

  const stageBuckets = useMemo(() => {
    const grouped: Record<StageKey, Candidate[]> = {
      ATS: [],
      MCQ: [],
      CODING: [],
      INTERVIEW: [],
      SELECTED: [],
    };
    for (const candidate of filteredCandidates) {
      grouped[normalizeStage(candidate.pipelineStep)].push(candidate);
    }
    for (const key of Object.keys(grouped) as StageKey[]) {
      grouped[key].sort((a, b) => (a.rankPosition ?? 999) - (b.rankPosition ?? 999));
    }
    return grouped;
  }, [filteredCandidates]);

  const stageMetrics = useMemo(() => {
    const total = filteredCandidates.length || 1;
    return STAGES.map((stage, index) => {
      const count = stageBuckets[stage.key].length;
      const previous = index === 0 ? filteredCandidates.length : stageBuckets[STAGES[index - 1].key].length || 1;
      return {
        ...stage,
        count,
        conversion: Math.round((count / previous) * 100),
        progress: Math.round((count / total) * 100),
      };
    });
  }, [filteredCandidates.length, stageBuckets]);
  const currentRound = useMemo(() => resolveCurrentRound(candidates), [candidates]);

  const histogramData = useMemo(() => {
    const bins = [
      { range: '0-20', min: 0, max: 20, count: 0 },
      { range: '21-40', min: 21, max: 40, count: 0 },
      { range: '41-60', min: 41, max: 60, count: 0 },
      { range: '61-80', min: 61, max: 80, count: 0 },
      { range: '81-100', min: 81, max: 100, count: 0 },
    ];
    for (const candidate of candidates) {
      const score = Number(candidate.atsScore ?? 0);
      const target = bins.find((bin) => score >= bin.min && score <= bin.max);
      if (target) target.count += 1;
    }
    return bins;
  }, [candidates]);

  const activity = useMemo(() => {
    const counts = {
      MCQ: candidates.filter((c) => normalizeStage(c.pipelineStep) === "MCQ").length,
      CODING: candidates.filter((c) => normalizeStage(c.pipelineStep) === "CODING").length,
      INTERVIEW: candidates.filter((c) => normalizeStage(c.pipelineStep) === "INTERVIEW").length,
      SELECTED: candidates.filter((c) => normalizeStage(c.pipelineStep) === "SELECTED").length,
    };
    const timeline = [
      {
        id: 'status',
        title: currentRound.label,
        meta: `MCQ ${counts.MCQ}, Coding ${counts.CODING}, AI Interview ${counts.INTERVIEW}, Selected ${counts.SELECTED}`,
      },
      ...candidates.slice(0, 8).map((candidate) => ({
        id: candidate.applicationId,
        title: `${candidate.email} is in ${stageToLabel[normalizeStage(candidate.pipelineStep)]}`,
        meta: `ATS ${candidate.atsScore == null ? 'N/A' : candidate.atsScore.toFixed(2)} · Rank #${candidate.rankPosition ?? '-'}`,
      })),
    ];
    return timeline;
  }, [candidates, currentRound.label]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/40 bg-white/75 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-violet-500">SmartHire Command Center</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Real-time pipeline analytics, ATS-first ranking, and AI-ready recruitment workflows.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-violet-200 bg-violet-50 text-violet-700">
              Live updates every 20s
            </Badge>
            <div className="w-[240px]">
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search candidate"
              className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <Link href="/dashboard/hr/jobs/new">
              <Button className="rounded-2xl">Post Job</Button>
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-32 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800" />
          <div className="h-32 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800" />
          <div className="h-32 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800" />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        {stageMetrics.map((stage) => (
          <motion.div
            key={stage.key}
            whileHover={{ y: -4 }}
            className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/70"
            title="Conversion from previous stage"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{stage.label}</p>
              <Badge variant="secondary" className="rounded-full">{stage.conversion}%</Badge>
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{stage.count}</p>
            <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                style={{ width: `${stage.progress}%` }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/50 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <CalendarClock size={16} />
              <p className="text-sm font-semibold">Current Round + Deadline</p>
            </div>
            <Badge variant={currentRound.variant} className="rounded-full">
              {currentRound.label}
            </Badge>
          </div>
          <p className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
            {countdown(analytics?.job?.submissionDeadlineAt)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Deadline: {analytics?.job?.submissionDeadlineAt ? new Date(analytics.job.submissionDeadlineAt).toLocaleString() : 'Not set'}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-100/70 p-3 dark:bg-slate-800/70">
              <p className="text-xs text-slate-500">Total applicants</p>
              <p className="text-lg font-semibold">{analytics?.job?.shortlistTotalSubmissions ?? selectedJob?.applications?.length ?? 0}</p>
            </div>
            <div className="rounded-xl bg-slate-100/70 p-3 dark:bg-slate-800/70">
              <p className="text-xs text-slate-500">Shortlisted</p>
              <p className="text-lg font-semibold">{analytics?.job?.shortlistSelectedCount ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Target size={16} />
            <p className="text-sm font-semibold">Hiring Pulse</p>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-100/70 px-3 py-2 dark:bg-slate-800/70">
              <span className="text-xs text-slate-500">Active jobs</span>
              <span className="font-semibold">{summary?.activeJobs ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-100/70 px-3 py-2 dark:bg-slate-800/70">
              <span className="text-xs text-slate-500">Applicants</span>
              <span className="font-semibold">{summary?.totalApplicants ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-100/70 px-3 py-2 dark:bg-slate-800/70">
              <span className="text-xs text-slate-500">Completion</span>
              <span className="font-semibold">{summary?.completionRate ?? 0}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/70 p-5 dark:border-violet-900 dark:bg-violet-950/20">
          <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
            <Sparkles size={16} />
            <p className="text-sm font-semibold">Automation Status</p>
          </div>
          <p className="mt-3 text-sm text-violet-700/90 dark:text-violet-200">
            The board is WebSocket-ready. Current implementation auto-refreshes with polling for near real-time ATS and stage sync.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-violet-700 dark:text-violet-300">
            <BellRing size={14} />
            Last tick: {clockTick}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Hiring Pipeline Overview</p>
              <p className="text-xs text-slate-500">Snapshot only. Open full board for drag-and-drop stage operations.</p>
            </div>
            <Link href="/dashboard/hr/pipeline">
              <Button className="rounded-xl">Open Full Pipeline</Button>
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stageMetrics.map((stage) => (
              <div
                key={stage.key}
                className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/50"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{stage.label}</p>
                  <Badge variant="outline" className="rounded-full">{stage.count}</Badge>
                </div>
                <p className="text-xs text-slate-500">Conversion from previous stage: {stage.conversion}%</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-violet-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Activity Feed Overview</p>
            </div>
            <Link href="/dashboard/hr/activity">
              <Button variant="outline" className="rounded-xl">Open Full Feed</Button>
            </Link>
          </div>
          <div className="space-y-3">
            {activity.slice(0, 4).map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <p className="text-sm font-medium text-slate-900 dark:text-white">{event.title}</p>
                <p className="mt-1 text-xs text-slate-500">{event.meta}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Funnel Conversion</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageMetrics}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartTheme.axis }} />
                <YAxis tick={{ fontSize: 12, fill: chartTheme.axis }} />
                <Tooltip contentStyle={{ backgroundColor: chartTheme.tooltipBg, borderRadius: 10, border: `1px solid ${chartTheme.grid}`, color: chartTheme.tooltipText }} />
                <Bar dataKey="count" fill={chartTheme.primary} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Applicant Growth</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary?.dailyApplicants || []}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTheme.axis }} />
                <YAxis tick={{ fontSize: 12, fill: chartTheme.axis }} />
                <Tooltip contentStyle={{ backgroundColor: chartTheme.tooltipBg, borderRadius: 10, border: `1px solid ${chartTheme.grid}`, color: chartTheme.tooltipText }} />
                <Line type="monotone" dataKey="applicants" stroke={chartTheme.tertiary} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">ATS Score Distribution</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={histogramData}>
                <defs>
                  <linearGradient id="atsScoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartTheme.primary} stopOpacity={0.7} />
                    <stop offset="95%" stopColor={chartTheme.primary} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 12, fill: chartTheme.axis }} />
                <YAxis tick={{ fontSize: 12, fill: chartTheme.axis }} />
                <Tooltip contentStyle={{ backgroundColor: chartTheme.tooltipBg, borderRadius: 10, border: `1px solid ${chartTheme.grid}`, color: chartTheme.tooltipText }} />
                <Area type="monotone" dataKey="count" stroke={chartTheme.primary} fill="url(#atsScoreFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {!jobs.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center dark:border-slate-700 dark:bg-slate-900/60">
          <CircleAlert className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">No jobs found. Create a job to activate the SaaS dashboard widgets.</p>
          <Link href="/dashboard/hr/jobs/new">
            <Button variant="outline" className="mt-4 rounded-2xl">Create your first job</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
};
