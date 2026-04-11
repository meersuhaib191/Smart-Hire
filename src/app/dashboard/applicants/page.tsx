"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoadingSkeleton } from "@/components/ui/PageLoadingSkeleton";
import { Button } from "@/components/ui/Button";
import { CandidateCard } from "@/components/pipeline/CandidateCard";
import { PipelineStageColumn } from "@/components/pipeline/PipelineStageColumn";
import { AdvanceStageModal } from "@/components/pipeline/AdvanceStageModal";
import { CandidateRow, PipelineStageId, scoreFor, stageOrder, stageLabels } from "@/components/pipeline/types";
import { BrainCircuit, Briefcase, Share2, Sparkles, Users } from "lucide-react";

type JobRow = {
  id: string;
  title: string;
  status?: string;
  submission_deadline_at?: string | null;
  shortlist_status?: string | null;
  shortlist_ran_at?: string | null;
  shortlist_selected_count?: number;
  shortlist_total_submissions?: number;
  applicantCount: number;
};

type ShortlistMeta = {
  id: string;
  title: string;
  submissionDeadlineAt: string | null;
  shortlistStatus: string | null;
  shortlistRanAt: string | null;
  shortlistSelectedCount: number;
  shortlistTotalSubmissions: number;
};

export default function ApplicantsDashboard() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobId, setJobId] = useState<string>("");
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<null | "ats" | "advance" | "move">(null);
  const [activity, setActivity] = useState<Array<{ at: string; message: string }>>([]);
  const [shortlistMeta, setShortlistMeta] = useState<ShortlistMeta | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/hr/jobs", { cache: "no-store" });
        const json = await res.json();
        if (res.ok && json.jobs?.length) {
          const normalizedJobs: JobRow[] = (json.jobs as Array<{
            id: string;
            title: string;
            status?: string;
            submission_deadline_at?: string | null;
            shortlist_status?: string | null;
            shortlist_ran_at?: string | null;
            shortlist_selected_count?: number;
            shortlist_total_submissions?: number;
            applications?: Array<{ id: string }>;
          }>).map((job) => ({
            id: job.id,
            title: job.title,
            status: job.status,
            submission_deadline_at: job.submission_deadline_at || null,
            shortlist_status: job.shortlist_status || null,
            shortlist_ran_at: job.shortlist_ran_at || null,
            shortlist_selected_count: Number(job.shortlist_selected_count || 0),
            shortlist_total_submissions: Number(job.shortlist_total_submissions || 0),
            applicantCount: Array.isArray(job.applications) ? job.applications.length : 0,
          }));
          setJobs(normalizedJobs);
          setJobId(normalizedJobs[0].id);
        } else if (!res.ok) {
          setErrorMessage(json.error || "Failed to load HR jobs.");
        }
      } finally {
        setLoadingJobs(false);
      }
    })();
  }, []);

  const loadCandidates = async (selectedJobId: string) => {
    setLoadingCandidates(true);
    try {
      const res = await fetch(`/api/hr/jobs/${selectedJobId}/analytics`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) {
        setCandidates(json.candidates || []);
        setShortlistMeta((json.job as ShortlistMeta | null) || null);
        setErrorMessage("");
      } else {
        setCandidates([]);
        setShortlistMeta(null);
        setErrorMessage(json.error || "Failed to load candidate analytics.");
      }
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;
    void loadCandidates(jobId);
    const interval = window.setInterval(() => {
      void loadCandidates(jobId);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [jobId]);

  const selectedTitle = jobs.find((j) => j.id === jobId)?.title || "Pipeline";
  const selectedJob = jobs.find((j) => j.id === jobId) || null;
  const totalApplicants = candidates.length;

  const stageBuckets = useMemo(() => {
    const bucket: Record<PipelineStageId, CandidateRow[]> = {
      ATS: [],
      MCQ: [],
      CODING: [],
      INTERVIEW: [],
      COMPLETE: [],
      REJECTED: [],
    };
    for (const c of candidates) {
      const step = String(c.pipelineStep || "ATS").toUpperCase();
      const normalized = (["ATS", "MCQ", "CODING", "INTERVIEW", "COMPLETE", "REJECTED"].includes(step)
        ? step
        : "ATS") as PipelineStageId;
      bucket[normalized].push(c);
    }
    for (const key of Object.keys(bucket) as PipelineStageId[]) {
      bucket[key] = bucket[key].sort((a, b) => scoreFor(b) - scoreFor(a));
    }
    return bucket;
  }, [candidates]);

  const conversion = (stage: PipelineStageId) => {
    const idx = stageOrder.indexOf(stage);
    if (idx <= 0) return totalApplicants ? 100 : 0;
    const prev = stageOrder[idx - 1];
    const prevCount = stageBuckets[prev].length;
    if (!prevCount) return 0;
    return (stageBuckets[stage].length / prevCount) * 100;
  };

  const runAtsScreening = async () => {
    if (!jobId) return;
    setActionLoading("ats");
    setActionMessage("");
    try {
      const res = await fetch(`/api/hr/jobs/${jobId}/run-ats`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to run ATS screening.");
      setActionMessage(`ATS screening completed. Screened: ${json.screened}, Skipped: ${json.skipped}, Failed: ${json.failed}.`);
      setActivity((prev) => [
        { at: new Date().toISOString(), message: `ATS screening completed for ${selectedTitle}.` },
        ...prev,
      ].slice(0, 30));
      await loadCandidates(jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run ATS screening.";
      setErrorMessage(message);
    } finally {
      setActionLoading(null);
    }
  };

  const runShortlist = async () => {
    if (!jobId) return;
    setActionLoading("advance");
    setActionMessage("");
    try {
      const res = await fetch(`/api/hr/jobs/${jobId}/run-shortlist`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to run shortlist.");
      const result = (json.result || {}) as {
        status?: string;
        reason?: string;
        shortlisted?: number;
        totalApplicants?: number;
      };
      if (result.status === "skipped") {
        setActionMessage(`Shortlist skipped: ${result.reason || "not_due"}.`);
      } else {
        setActionMessage(
          `Shortlist completed. Selected ${Number(result.shortlisted || 0)} of ${Number(
            result.totalApplicants || 0
          )} applicants.`
        );
      }
      setActivity((prev) => [
        { at: new Date().toISOString(), message: "Ran ATS deadline shortlist." },
        ...prev,
      ].slice(0, 30));
      await loadCandidates(jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run shortlist.";
      setErrorMessage(message);
    } finally {
      setActionLoading(null);
    }
  };

  const advanceTopN = async (
    fromStage: "ATS" | "MCQ" | "CODING",
    payload: { topN: number; deadlineAt?: string; directives?: string }
  ) => {
    if (!jobId) return;
    setActionLoading("advance");
    setActionMessage("");
    try {
      const res = await fetch(`/api/hr/jobs/${jobId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromStage,
          topN: Number(payload.topN) || 1,
          rejectRest: false,
          deadlineAt: payload.deadlineAt,
          directives: payload.directives,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to advance top candidates.");
      const nextStage = String(json.nextStage || "").toUpperCase() as PipelineStageId;
      const prettyNext = stageLabels[nextStage] || nextStage || "next stage";
      if ((json.advanced || 0) > 0 && nextStage) {
        setActionMessage(`Moved ${json.advanced} candidate(s) from ${stageLabels[fromStage]} to ${prettyNext}.`);
        setActivity((prev) => [
          {
            at: new Date().toISOString(),
            message: `Moved top ${payload.topN} candidates from ${stageLabels[fromStage]} to ${prettyNext}.`,
          },
          ...prev,
        ].slice(0, 30));
      } else {
        const fallbackMessage = json.message || `No candidates moved from ${stageLabels[fromStage]}.`;
        setActionMessage(fallbackMessage);
        setActivity((prev) => [
          { at: new Date().toISOString(), message: fallbackMessage },
          ...prev,
        ].slice(0, 30));
      }
      await loadCandidates(jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to advance top candidates.";
      setErrorMessage(message);
    } finally {
      setActionLoading(null);
    }
  };

  const moveCandidate = async (applicationId: string, stage: PipelineStageId) => {
    setActionLoading("move");
    try {
      const res = await fetch(`/api/hr/applications/${applicationId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStage: stage }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to move candidate.");
      setActivity((prev) => [
        { at: new Date().toISOString(), message: `Candidate ${applicationId.slice(0, 8)} moved to ${stageLabels[stage]}.` },
        ...prev,
      ].slice(0, 30));
      await loadCandidates(jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to move candidate.";
      setErrorMessage(message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Candidate Pipeline</h1>
          <p className="mt-2 text-sm text-slate-500">
            Visual funnel and stage orchestration for <span className="font-medium text-slate-900">{selectedTitle}</span>
          </p>
        </div>
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Select Job</p>
          <Select
            value={jobId}
            onValueChange={setJobId}
            disabled={loadingJobs || !jobs.length}
          >
            <SelectTrigger className="h-11 rounded-xl border-slate-200">
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
          {selectedJob ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-lg">
                <Briefcase size={12} className="mr-1" />
                {selectedJob.status || "PUBLISHED"}
              </Badge>
              <Badge variant="outline" className="rounded-lg">
                {selectedJob.applicantCount} applicants
              </Badge>
            </div>
          ) : null}
          {jobs.length > 1 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {jobs.slice(0, 5).map((job) => (
                <Button
                  key={job.id}
                  type="button"
                  size="sm"
                  variant={job.id === jobId ? "primary" : "outline"}
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => setJobId(job.id)}
                >
                  {job.title}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {loadingCandidates ? <PageLoadingSkeleton /> : null}
      {!loadingCandidates && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      {actionMessage ? <p className="text-sm text-green-600">{actionMessage}</p> : null}

      <Card className="rounded-2xl border-slate-200/80 bg-white/95 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Funnel Overview</CardTitle>
              <CardDescription>
                Total applicants: <span className="font-medium text-slate-800">{totalApplicants}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">Active</Badge>
              <Button variant="outline" className="rounded-xl">
                <Share2 size={14} className="mr-2" />
                Share Job
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {stageOrder.map((stage, idx) => (
              <div key={stage} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{stageLabels[stage]}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{stageBuckets[stage].length}</p>
                <p className="text-xs text-slate-500">{idx === 0 ? "Entry stage" : `${conversion(stage).toFixed(0)}% from previous`}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200/80 bg-white/95 shadow-sm">
        <CardHeader>
          <CardTitle>Smart Actions</CardTitle>
          <CardDescription>
            Run ATS, then advance top candidates through MCQ, Coding, and AI Interview with a guided modal.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Button onClick={runAtsScreening} disabled={!jobId || actionLoading !== null} className="rounded-xl">
            {actionLoading === "ats" ? "Running ATS..." : "Run ATS Screening"}
          </Button>

          <AdvanceStageModal
            fromStage="ATS"
            nextStage="MCQ"
            max={stageBuckets.ATS.length}
            disabled={!jobId || actionLoading !== null || stageBuckets.ATS.length === 0}
            onConfirm={async (data) => advanceTopN("ATS", data)}
          />
          <AdvanceStageModal
            fromStage="MCQ"
            nextStage="CODING"
            max={stageBuckets.MCQ.length}
            disabled={!jobId || actionLoading !== null || stageBuckets.MCQ.length === 0}
            onConfirm={async (data) => advanceTopN("MCQ", data)}
          />
          <AdvanceStageModal
            fromStage="CODING"
            nextStage="INTERVIEW"
            max={stageBuckets.CODING.length}
            disabled={!jobId || actionLoading !== null || stageBuckets.CODING.length === 0}
            onConfirm={async (data) => advanceTopN("CODING", data)}
          />
          <Button
            variant="outline"
            onClick={runShortlist}
            disabled={!jobId || actionLoading !== null}
            className="rounded-xl"
          >
            {actionLoading === "advance" ? "Running shortlist..." : "Run Deadline Shortlist"}
          </Button>
        </CardContent>
      </Card>

      {shortlistMeta ? (
        <Card className="rounded-2xl border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle>Deadline Shortlist Status</CardTitle>
            <CardDescription>Automatic ATS-based top 20% selection after submission deadline.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Submission Deadline</p>
              <p className="text-sm font-medium text-slate-900">
                {shortlistMeta.submissionDeadlineAt
                  ? new Date(shortlistMeta.submissionDeadlineAt).toLocaleString()
                  : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Shortlist Status</p>
              <p className="text-sm font-medium text-slate-900">{shortlistMeta.shortlistStatus || "pending"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Selected</p>
              <p className="text-sm font-medium text-slate-900">{shortlistMeta.shortlistSelectedCount || 0}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Submissions</p>
              <p className="text-sm font-medium text-slate-900">{shortlistMeta.shortlistTotalSubmissions || 0}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-4 xl:grid-cols-5">
          {stageOrder.map((stage) => (
            <PipelineStageColumn
              key={stage}
              stage={stage}
              count={stageBuckets[stage].length}
              conversionRate={conversion(stage)}
              onDropApplication={(applicationId, targetStage) => {
                void moveCandidate(applicationId, targetStage);
              }}
            >
              {stageBuckets[stage].length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                  <p className="text-sm font-medium text-slate-700">No candidates yet</p>
                  <p className="mt-1 text-xs text-slate-500">Drag candidates here or use advance actions.</p>
                </div>
              ) : (
                stageBuckets[stage].map((candidate) => (
                  <CandidateCard
                    key={candidate.applicationId}
                    candidate={candidate}
                    onMove={(applicationId, targetStage) => {
                      void moveCandidate(applicationId, targetStage);
                    }}
                    onReject={(applicationId) => {
                      void moveCandidate(applicationId, "REJECTED");
                    }}
                    onView={(applicationId) => {
                      setActionMessage(`Application ID: ${applicationId}`);
                    }}
                  />
                ))
              )}
            </PipelineStageColumn>
          ))}
        </div>

        <Card className="rounded-2xl border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" />
              <CardTitle className="text-lg">Activity Feed</CardTitle>
            </div>
            <CardDescription>Live stage operations and screening events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.length === 0 ? (
              <EmptyState
                title="No candidate activity yet"
                description="Run ATS screening or move candidates to start pipeline activity."
                icon={<BrainCircuit size={18} />}
                action={
                  <Button variant="outline" className="rounded-xl">
                    <Users size={14} className="mr-2" />
                    Invite Candidates
                  </Button>
                }
              />
            ) : (
              activity.map((a, idx) => (
                <div key={`${a.at}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-800">{a.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(a.at).toLocaleString()}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {!loadingCandidates && jobId && candidates.length === 0 ? (
        <EmptyState
          title="No candidates yet"
          description="Share this job and invite candidates to begin your hiring pipeline."
          icon={<Users size={18} />}
          action={
            <Button variant="outline" className="rounded-xl">
              <Share2 size={14} className="mr-2" />
              Share Job
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
