"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp } from "lucide-react";

type JobRow = {
  id: string;
  title: string;
};

type Candidate = {
  applicationId: string;
  email: string;
  pipelineStep: string;
  atsScore: number | null;
  rankPosition: number | null;
};

type AnalyticsPayload = {
  job: {
    shortlistStatus: string | null;
    shortlistSelectedCount: number;
    shortlistTotalSubmissions: number;
  } | null;
  candidates: Candidate[];
};

const stageLabel = (pipelineStep: string) => {
  const normalized = String(pipelineStep || "").toUpperCase();
  if (normalized.includes("MCQ")) return "MCQ";
  if (normalized.includes("CODING")) return "Coding";
  if (normalized.includes("INTERVIEW")) return "AI Interview";
  if (normalized.includes("SELECTED") || normalized.includes("HIRED") || normalized.includes("COMPLETE")) return "Selected";
  return "ATS";
};

export default function HrActivityPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/hr/jobs", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const nextJobs = (json.jobs || []) as JobRow[];
      setJobs(nextJobs);
      if (nextJobs.length) setSelectedJobId(nextJobs[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;
    (async () => {
      const res = await fetch(`/api/hr/jobs/${selectedJobId}/analytics`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setAnalytics({ job: json.job || null, candidates: json.candidates || [] });
    })();
  }, [selectedJobId]);

  const activity = useMemo(
    () => [
      {
        id: "status",
        title: `Shortlist status: ${analytics?.job?.shortlistStatus || "pending"}`,
        meta: `Applicants ${analytics?.job?.shortlistTotalSubmissions || 0}, shortlisted ${analytics?.job?.shortlistSelectedCount || 0}`,
      },
      ...(analytics?.candidates || []).map((candidate) => ({
        id: candidate.applicationId,
        title: `${candidate.email} is in ${stageLabel(candidate.pipelineStep)}`,
        meta: `ATS ${candidate.atsScore == null ? "N/A" : candidate.atsScore.toFixed(2)} · Rank #${candidate.rankPosition ?? "-"}`,
      })),
    ],
    [analytics]
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription>Detailed feed for shortlist and candidate stage events.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={!jobs.length}>
            <SelectTrigger className="max-w-xl">
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
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-violet-500" />
            <CardTitle className="text-lg">Live Activity Stream</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {activity.map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{event.title}</p>
              <p className="mt-1 text-xs text-slate-500">{event.meta}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

