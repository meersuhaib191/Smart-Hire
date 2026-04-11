"use client";

import { useEffect, useMemo, useState } from "react";
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
  rankPosition: number | null;
};

export default function HrCandidatesPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobId, setJobId] = useState("");
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        return;
      }
      setError("");
      setCandidates((json.candidates || []) as CandidateRow[]);
    })();
  }, [jobId]);

  const sorted = useMemo(
    () =>
      [...candidates].sort((a, b) => {
        const ra = a.rankPosition ?? Number.MAX_SAFE_INTEGER;
        const rb = b.rankPosition ?? Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        return (b.finalScore || 0) - (a.finalScore || 0);
      }),
    [candidates]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Candidates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ranked candidate list by ATS score and stage progression for each job.
        </p>
      </div>

      <Card className="rounded-2xl border-slate-200/80">
        <CardHeader>
          <CardTitle>Select Job</CardTitle>
          <CardDescription>Choose a role to review ranked candidates.</CardDescription>
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

      <Card className="rounded-2xl border-slate-200/80">
        <CardHeader>
          <CardTitle>Ranked Candidates</CardTitle>
          <CardDescription>Top-ranked applicants appear first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!sorted.length && !error ? <p className="text-sm text-slate-500">No candidates found for this job.</p> : null}
          {sorted.map((candidate) => (
            <div key={candidate.applicationId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{candidate.email}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">rank #{candidate.rankPosition ?? "-"}</Badge>
                  <Badge variant="secondary">{candidate.pipelineStep || "ATS"}</Badge>
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                ATS score:{" "}
                {candidate.finalScore == null ? "-" : Number(candidate.finalScore).toFixed(2)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
