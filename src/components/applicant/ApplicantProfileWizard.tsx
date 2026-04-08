"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { supabase } from "@/utils/supabase/client";
import { toast } from "sonner";

type WizardMode = "onboarding" | "manage";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  skillsInput: string;
  skills: string[];
  experienceYears: number;
  experienceSummary: string;
  education: string;
  resumeUrl: string;
  linkedin: string;
  portfolio: string;
  bio: string;
};

const initialState: FormState = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  skillsInput: "",
  skills: [],
  experienceYears: 0,
  experienceSummary: "",
  education: "",
  resumeUrl: "",
  linkedin: "",
  portfolio: "",
  bio: "",
};

const steps = [
  { id: 1, title: "Personal" },
  { id: 2, title: "Professional" },
  { id: 3, title: "Resume" },
  { id: 4, title: "Additional" },
];

export function ApplicantProfileWizard({ mode }: { mode: WizardMode }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(initialState);

  const progress = useMemo(() => (step / steps.length) * 100, [step]);
  const storageKey = mode === "onboarding" ? "applicant-profile-onboarding-draft" : "applicant-profile-manage-draft";

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        const meJson = await meRes.json();
        const email = meJson?.user?.email || "";
        const meName = meJson?.user?.name || "";

        const profileRes = await fetch("/api/applicant/profile");
        const profileJson = await profileRes.json();

        const persisted = window.localStorage.getItem(storageKey);
        const draft = persisted ? (JSON.parse(persisted) as Partial<FormState>) : {};
        const server = profileJson?.profile || {};

        setForm((prev) => ({
          ...prev,
          email,
          fullName: server.fullName || meName || prev.fullName,
          phone: server.phone || prev.phone,
          location: server.location || prev.location,
          skills: server.skills || prev.skills,
          experienceYears: Number(server.experienceYears || prev.experienceYears),
          experienceSummary: server.experienceSummary || prev.experienceSummary,
          education: server.education || prev.education,
          resumeUrl: server.resumeUrl || prev.resumeUrl,
          linkedin: server.linkedin || prev.linkedin,
          portfolio: server.portfolio || prev.portfolio,
          bio: server.bio || prev.bio,
          ...draft,
        }));
      } catch {
        // ignore; user will still be able to fill profile
      } finally {
        setLoading(false);
      }
    })();
  }, [storageKey]);

  useEffect(() => {
    if (loading) return;
    window.localStorage.setItem(storageKey, JSON.stringify(form));
  }, [form, loading, storageKey]);

  const addSkill = () => {
    const value = form.skillsInput.trim();
    if (!value || form.skills.includes(value)) return;
    setForm((prev) => ({ ...prev, skills: [...prev.skills, value], skillsInput: "" }));
  };

  const removeSkill = (skill: string) => {
    setForm((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skill) }));
  };

  const uploadResume = async (file: File) => {
    const ext = file.name.split(".").pop() || "pdf";
    const key = `resume_${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage.from("resumes").upload(key, file, {
      upsert: true,
      contentType: file.type || "application/pdf",
    });

    if (error || !data?.path) {
      toast.error("Resume upload failed. You can paste a resume URL manually.");
      return;
    }

    const { data: publicData } = supabase.storage.from("resumes").getPublicUrl(data.path);
    setForm((prev) => ({ ...prev, resumeUrl: publicData.publicUrl }));
    toast.success("Resume uploaded");
  };

  const save = async (complete: boolean) => {
    if (!form.fullName.trim()) {
      toast.error("Full name is required.");
      setStep(1);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/applicant/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          isProfileComplete: complete,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save profile.");
      }

      if (complete) {
        await supabase.auth.updateUser({
          data: { isProfileComplete: true },
        });
        window.localStorage.removeItem(storageKey);
      }
      toast.success(complete ? "Profile completed successfully." : "Profile saved.");
      if (complete && mode === "onboarding") {
        window.location.href = "/applicant/dashboard";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save profile.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading profile...</p>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {mode === "onboarding" ? "Complete your applicant profile" : "Manage your profile"}
        </h1>
        <p className="text-sm text-slate-500">
          {mode === "onboarding"
            ? "Finish onboarding to unlock recommended jobs and assessments."
            : "Keep your profile updated to improve matching quality."}
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>Step {step} of 4</CardTitle>
            <Badge variant="secondary">{Math.round(progress)}% complete</Badge>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex flex-wrap gap-2">
            {steps.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${step === s.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full Name" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
              <Input label="Email" value={form.email} disabled />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              <Input label="Location" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Skills</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a skill and press Add"
                    value={form.skillsInput}
                    onChange={(e) => setForm((p) => ({ ...p, skillsInput: e.target.value }))}
                  />
                  <Button type="button" variant="outline" onClick={addSkill}>
                    Add
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.skills.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                    >
                      {skill} ✕
                    </button>
                  ))}
                </div>
              </div>
              <Input
                label="Experience (Years)"
                type="number"
                min={0}
                value={String(form.experienceYears)}
                onChange={(e) => setForm((p) => ({ ...p, experienceYears: Number(e.target.value || 0) }))}
              />
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Experience Summary</label>
                <Textarea
                  className="min-h-24"
                  value={form.experienceSummary}
                  onChange={(e) => setForm((p) => ({ ...p, experienceSummary: e.target.value }))}
                />
              </div>
              <Input
                label="Education"
                value={form.education}
                onChange={(e) => setForm((p) => ({ ...p, education: e.target.value }))}
              />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <CardDescription>Upload your latest resume (PDF preferred).</CardDescription>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadResume(file);
                }}
              />
              <Input
                label="Resume URL"
                value={form.resumeUrl}
                onChange={(e) => setForm((p) => ({ ...p, resumeUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <Input label="LinkedIn URL" value={form.linkedin} onChange={(e) => setForm((p) => ({ ...p, linkedin: e.target.value }))} />
              <Input label="Portfolio URL" value={form.portfolio} onChange={(e) => setForm((p) => ({ ...p, portfolio: e.target.value }))} />
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Bio / Summary</label>
                <Textarea className="min-h-28" value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} />
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="outline" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
              Previous
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => save(false)} disabled={saving}>
                Save Draft
              </Button>
              {step < 4 ? (
                <Button type="button" onClick={() => setStep((s) => Math.min(4, s + 1))}>
                  Next
                </Button>
              ) : (
                <Button type="button" onClick={() => save(true)} isLoading={saving}>
                  {mode === "onboarding" ? "Complete Profile" : "Save Profile"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
