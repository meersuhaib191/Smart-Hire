"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type JobPayload = {
  id: string;
  title: string;
  description: string;
  experience_required: number;
  submission_deadline_at: string | null;
  status: string;
  skills: string[];
  weights: {
    ats_weight: number;
    mcq_weight: number;
    coding_weight: number;
    interview_weight: number;
  };
};

export default function HrEditJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [experienceRequired, setExperienceRequired] = useState(0);
  const [submissionDeadlineAt, setSubmissionDeadlineAt] = useState("");
  const [status, setStatus] = useState("PUBLISHED");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [weights, setWeights] = useState({
    ats_weight: 1,
    mcq_weight: 0,
    coding_weight: 0,
    interview_weight: 0,
  });

  const totalWeight = useMemo(
    () =>
      Number(weights.ats_weight) +
      Number(weights.mcq_weight) +
      Number(weights.coding_weight) +
      Number(weights.interview_weight),
    [weights]
  );

  useEffect(() => {
    if (!jobId) return;
    (async () => {
      try {
        const res = await fetch(`/api/hr/jobs/${jobId}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error || "Failed to load job.");
          return;
        }
        const job = json.job as JobPayload;
        setTitle(job.title || "");
        setDescription(job.description || "");
        setExperienceRequired(Number(job.experience_required || 0));
        setSubmissionDeadlineAt(
          job.submission_deadline_at ? new Date(job.submission_deadline_at).toISOString().slice(0, 16) : ""
        );
        setStatus(String(job.status || "PUBLISHED").toUpperCase());
        setSkills(Array.isArray(job.skills) ? job.skills : []);
        setWeights(job.weights || weights);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  const addSkill = () => {
    const value = skillInput.trim();
    if (!value || skills.includes(value)) return;
    setSkills((prev) => [...prev, value]);
    setSkillInput("");
  };

  const removeSkill = (value: string) => {
    setSkills((prev) => prev.filter((s) => s !== value));
  };

  const save = async () => {
    if (!jobId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        title,
        description,
        experience_required: Number(experienceRequired || 0),
        submission_deadline_at: submissionDeadlineAt ? new Date(submissionDeadlineAt).toISOString() : null,
        status,
        skills,
        weights,
      };
      const res = await fetch(`/api/hr/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to update job.");
      setMessage("Job updated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update job.");
    } finally {
      setSaving(false);
    }
  };

  const rollback = async () => {
    if (!jobId) return;
    setRollingBack(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/hr/jobs/${jobId}/rollback`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to rollback ATS.");
      setMessage(
        `ATS and shortlist reset complete. ${Number(json.resetApplications || 0)} application(s) reset to ATS stage.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rollback ATS.");
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Edit Job</h1>
          <p className="mt-1 text-sm text-slate-500">
            Update role settings, then rollback ATS/shortlist to re-run automation on the new deadline.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/hr/jobs")}>
          Back to Jobs
        </Button>
      </div>

      <Card className="rounded-2xl border-slate-200/80">
        <CardHeader>
          <CardTitle>Job Configuration</CardTitle>
          <CardDescription>All changes apply to future ATS automation cycles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-slate-500">Loading job...</p> : null}
          {!loading ? (
            <>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[140px]"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Experience (years)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={String(experienceRequired)}
                    onChange={(e) => setExperienceRequired(Number(e.target.value || 0))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Submission Deadline</Label>
                  <Input
                    type="datetime-local"
                    value={submissionDeadlineAt}
                    onChange={(e) => setSubmissionDeadlineAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Input value={status} onChange={(e) => setStatus(e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Required Skills</Label>
                <div className="flex gap-2">
                  <Input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    placeholder="Add a skill"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                  />
                  <Button type="button" onClick={addSkill}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <Badge key={skill} variant="outline" className="cursor-pointer" onClick={() => removeSkill(skill)}>
                      {skill} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>ATS Weight</Label>
                  <Input
                    type="number"
                    step="0.05"
                    value={String(weights.ats_weight)}
                    onChange={(e) => setWeights((prev) => ({ ...prev, ats_weight: Number(e.target.value || 0) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>MCQ Weight</Label>
                  <Input
                    type="number"
                    step="0.05"
                    value={String(weights.mcq_weight)}
                    onChange={(e) => setWeights((prev) => ({ ...prev, mcq_weight: Number(e.target.value || 0) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Coding Weight</Label>
                  <Input
                    type="number"
                    step="0.05"
                    value={String(weights.coding_weight)}
                    onChange={(e) => setWeights((prev) => ({ ...prev, coding_weight: Number(e.target.value || 0) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interview Weight</Label>
                  <Input
                    type="number"
                    step="0.05"
                    value={String(weights.interview_weight)}
                    onChange={(e) =>
                      setWeights((prev) => ({ ...prev, interview_weight: Number(e.target.value || 0) }))
                    }
                  />
                </div>
              </div>
              <p className={`text-sm ${Math.abs(totalWeight - 1) <= 0.01 ? "text-green-600" : "text-red-600"}`}>
                Total weight: {totalWeight.toFixed(2)} / 1.00
              </p>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {message ? <p className="text-sm text-green-600">{message}</p> : null}

              <div className="flex flex-wrap gap-3">
                <Button onClick={save} disabled={saving || rollingBack}>
                  {saving ? "Saving..." : "Save Job Changes"}
                </Button>
                <Button variant="danger" onClick={rollback} disabled={saving || rollingBack}>
                  {rollingBack ? "Rolling back..." : "Rollback ATS + Shortlist"}
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
