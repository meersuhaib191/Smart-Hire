"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type JobRow = {
  id: string;
  title: string;
};

type CandidateRow = {
  applicationId: string;
  email: string;
  pipelineStep: string;
  finalScore: number | null;
  atsScore: number | null;
  rankPosition: number | null;
  skills?: string[];
};

type JobAnalyticsMeta = {
  shortlistStatus: string | null;
  shortlistError: string | null;
};

export default function HrCandidatesPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobId, setJobId] = useState("");
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobMeta, setJobMeta] = useState<JobAnalyticsMeta | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/hr/jobs", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Failed to load jobs.");
        setLoading(false);
        return;
      }
      const normalized = ((json.jobs || []) as Array<{ id: string; title: string }>).map((j) => ({
        id: j.id,
        title: j.title,
      }));
      setJobs(normalized);
      if (normalized.length) setJobId(normalized[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!jobId) return;
    (async () => {
      const res = await fetch(`/api/hr/jobs/${jobId}/analytics`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Failed to load candidates.");
        setCandidates([]);
        setJobMeta(null);
        return;
      }
      setError("");
      setCandidates((json.candidates || []) as CandidateRow[]);
      setJobMeta((json.job || null) as JobAnalyticsMeta | null);
    })();
  }, [jobId]);

  const sorted = useMemo(
    () =>
      [...candidates].sort((a, b) => {
        const ra = a.rankPosition ?? Number.MAX_SAFE_INTEGER;
        const rb = b.rankPosition ?? Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        const bScore = b.atsScore ?? 0;
        const aScore = a.atsScore ?? 0;
        return bScore - aScore;
      }),
    [candidates]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/40 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Candidates</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          Ranked candidate list by ATS score and stage progression for each job.
        </p>
      </div>

      <Card className="rounded-2xl border-white/40 bg-white/80 dark:border-white/10 dark:bg-slate-900/70">
        <CardHeader>
          <CardTitle className="dark:text-white">Select Job</CardTitle>
          <CardDescription className="dark:text-slate-300">Choose a role to review ranked candidates.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={jobId} onValueChange={setJobId} disabled={loading || !jobs.length}>
            <SelectTrigger className="max-w-xl">
              <SelectValue placeholder="Choose a job" />
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

      <Card className="rounded-2xl border-white/40 bg-white/80 dark:border-white/10 dark:bg-slate-900/70">
        <CardHeader>
          <CardTitle className="dark:text-white">Ranked Candidates</CardTitle>
          <CardDescription className="dark:text-slate-300">Top-ranked applicants appear first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!error && jobMeta?.shortlistStatus === "failed" ? (
            <p className="text-sm text-amber-700">
              Shortlist failed for this job: {jobMeta.shortlistError || "Unknown error"}. ATS/ranking values stay blank
              until shortlist reruns successfully.
            </p>
          ) : null}
          {!sorted.length && !error ? <p className="text-sm text-slate-500 dark:text-slate-300">No candidates found for this job.</p> : null}
          {sorted.map((candidate) => (
            <motion.div
              key={candidate.applicationId}
              whileHover={{ y: -2 }}
              className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900 dark:text-white">{candidate.email}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">rank #{candidate.rankPosition ?? "-"}</Badge>
                  <Badge variant="secondary">{candidate.pipelineStep || "ATS"}</Badge>
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                ATS score: {candidate.atsScore == null ? "-" : Number(candidate.atsScore).toFixed(2)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {(candidate.skills || []).slice(0, 5).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
