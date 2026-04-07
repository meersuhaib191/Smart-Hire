"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";

type Detail = {
  application: {
    id: string;
    pipeline_step: string;
    current_stage: string;
    jobs: { id: string; title: string; description: string } | null;
  };
  stages: Array<{ stage_type: string; score: number; passed: boolean }>;
  ranking: { final_score: number; rank_position: number } | null;
  codingChallenge: { id: string; title: string } | null;
};

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [interviewText, setInterviewText] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/applicant/applications/${id}`);
        const json = await res.json();
        if (res.ok) setData(json);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const submitInterview = async () => {
    if (!data || !interviewText.trim()) return;
    const question = "Tell us about a project where you solved a complex problem.";
    const res = await fetch("/api/interview/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: data.application.id,
        question,
        answerText: interviewText,
        jobTitle: data.application.jobs?.title,
      }),
    });
    if (res.ok) {
      const reload = await fetch(`/api/applicant/applications/${id}`);
      const json = await reload.json();
      if (reload.ok) setData(json);
    }
  };

  const runFinalScoring = async () => {
    if (!data) return;
    const res = await fetch("/api/scoring/final", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: data.application.id }),
    });
    if (res.ok) {
      const reload = await fetch(`/api/applicant/applications/${id}`);
      const json = await reload.json();
      if (reload.ok) setData(json);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!data) return <p className="text-sm text-slate-500">Application not found.</p>;

  const step = data.application.pipeline_step;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/applicant/applications" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{data.application.jobs?.title || "Application"}</h1>
          <p className="text-sm text-slate-500">Current pipeline: {step}</p>
        </div>
        <Badge variant="secondary">{data.application.current_stage}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stage Results</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.stages.map((s) => (
            <Badge key={s.stage_type} variant="secondary">
              {s.stage_type}: {Number(s.score).toFixed(1)} {s.passed ? "✓" : ""}
            </Badge>
          ))}
          {data.stages.length === 0 ? <p className="text-sm text-slate-500">No stage scores yet.</p> : null}
        </CardContent>
      </Card>

      {step === "CODING" && data.codingChallenge ? (
        <Card>
          <CardHeader>
            <CardTitle>Coding Challenge</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/coding/${data.codingChallenge.id}?applicationId=${data.application.id}`}>
              <Button>Start Coding Stage</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {step === "MCQ" ? (
        <Card>
          <CardHeader>
            <CardTitle>MCQ Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/dashboard/applicant/applications/${data.application.id}/mcq`}>
              <Button>Start MCQ Stage</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {step === "INTERVIEW" ? (
        <Card>
          <CardHeader>
            <CardTitle>AI Interview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={interviewText}
              onChange={(e) => setInterviewText(e.target.value)}
              className="w-full min-h-28 border rounded-md p-3"
              placeholder="Type your interview answer..."
            />
            <Button onClick={submitInterview}>Submit Interview Answer</Button>
          </CardContent>
        </Card>
      ) : null}

      {step === "COMPLETE" || data.stages.length >= 4 ? (
        <Card>
          <CardHeader>
            <CardTitle>Final Ranking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={runFinalScoring}>Recompute Final Score</Button>
            <p className="text-sm">
              Final Score: {data.ranking?.final_score != null ? Number(data.ranking.final_score).toFixed(2) : "—"} · Rank #
              {data.ranking?.rank_position ?? "—"}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}