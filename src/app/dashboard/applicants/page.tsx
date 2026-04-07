"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type JobRow = { id: string; title: string };

type StageRow = { stage_type: string; score: number; passed: boolean };

type CandidateRow = {
  applicationId: string;
  email: string;
  pipelineStep: string;
  finalScore: number | null;
  rankPosition: number | null;
  stages: StageRow[];
};

export default function ApplicantsDashboard() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobId, setJobId] = useState<string>("");
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/hr/jobs");
        const json = await res.json();
        if (res.ok && json.jobs?.length) {
          setJobs(json.jobs);
          setJobId(json.jobs[0].id);
        }
      } finally {
        setLoadingJobs(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!jobId) return;
    (async () => {
      setLoadingCandidates(true);
      try {
        const res = await fetch(`/api/hr/jobs/${jobId}/analytics`);
        const json = await res.json();
        if (res.ok) {
          setCandidates(json.candidates || []);
        }
      } finally {
        setLoadingCandidates(false);
      }
    })();
  }, [jobId]);

  const selectedTitle = jobs.find((j) => j.id === jobId)?.title || "Select a job";

  const displayScore = (c: CandidateRow) => {
    if (c.finalScore != null) return Number(c.finalScore);
    const ats = c.stages.find((s) => s.stage_type === "ATS");
    return ats ? Number(ats.score) : 0;
  };

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applicant Tracking</h1>
          <p className="text-muted-foreground mt-2">
            Pipeline + stage scores for{" "}
            <span className="font-medium text-foreground">{selectedTitle}</span>
          </p>
        </div>
        <div className="w-full max-w-sm">
          <Select
            value={jobId}
            onValueChange={setJobId}
            disabled={loadingJobs || !jobs.length}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingJobs ? "Loading jobs…" : "Choose job"} />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadingCandidates ? (
        <p className="text-sm text-muted-foreground">Loading candidates…</p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {candidates.map((c) => {
          const score = displayScore(c);
          return (
            <Card key={c.applicationId} className="flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-xl truncate">{c.email}</CardTitle>
                    <CardDescription className="truncate">
                      {c.pipelineStep} · Rank #{c.rankPosition ?? "—"}
                    </CardDescription>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-2xl font-bold ${
                        score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500"
                      }`}
                    >
                      {score.toFixed(1)}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {c.finalScore != null ? "Final" : "Best available"}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Score</span>
                    <span className="font-medium">{score.toFixed(0)}</span>
                  </div>
                  <Progress value={Math.min(100, Math.max(0, score))} className="h-2" />
                </div>

                <div className="flex flex-wrap gap-1">
                  {c.stages.map((s) => (
                    <Badge key={s.stage_type} variant="secondary">
                      {s.stage_type}: {Number(s.score).toFixed(0)}
                      {s.passed ? " ✓" : ""}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loadingCandidates && jobId && candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No applications for this job yet.</p>
      ) : null}
    </div>
  );
}
