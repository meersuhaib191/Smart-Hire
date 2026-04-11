"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ChevronLeft, ChevronRight, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { sanitizeJob } from "@/components/jobs/job-utils";
import type { PublicJob } from "@/components/jobs/types";

type ApplyModalProps = {
  jobId: string;
};

type ProfileState = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
};

type ProfilePayload = {
  profile?: {
    fullName?: string;
    phone?: string;
    location?: string;
    resumeUrl?: string;
  };
};

const steps = ["Profile Info", "Resume Upload", "Questions", "Review"];

export function ApplyModal({ jobId }: ApplyModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [job, setJob] = useState<PublicJob | null>(null);
  const [currentResume, setCurrentResume] = useState<string>("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<ProfileState>({
    fullName: "",
    email: "",
    phone: "",
    location: "",
  });
  const [questions, setQuestions] = useState<Array<{ id: string; prompt: string }>>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const [meRes, profileRes, jobRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/applicant/profile"),
          fetch(`/api/jobs/${jobId}`),
        ]);

        const meJson = await meRes.json().catch(() => ({}));
        const profileJson = (await profileRes.json().catch(() => ({}))) as ProfilePayload;
        const jobJson = (await jobRes.json().catch(() => ({}))) as { job?: PublicJob };

        if (!meRes.ok) {
          toast.error("Please log in to apply.");
          return;
        }

        if (jobRes.ok && jobJson.job) {
          setJob(jobJson.job);
        }

        setProfile({
          fullName: profileJson.profile?.fullName || meJson?.user?.name || "",
          email: meJson?.user?.email || "",
          phone: profileJson.profile?.phone || "",
          location: profileJson.profile?.location || "",
        });

        if (profileJson.profile?.resumeUrl) {
          setCurrentResume(profileJson.profile.resumeUrl);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [jobId]);

  useEffect(() => {
    const tags = (job?.skills || []).slice(0, 3);
    const generated = [
      {
        id: "impact",
        prompt: "Tell us about one project where you delivered measurable impact.",
      },
      {
        id: "motivation",
        prompt: `Why are you interested in this ${sanitizeJob(job || defaultJob).title} role?`,
      },
      ...tags.map((skill) => ({
        id: `skill-${skill}`,
        prompt: `How have you applied ${skill} in a real-world product or project?`,
      })),
    ].slice(0, 4);
    setQuestions(generated);
  }, [job]);

  const canProceed = useMemo(() => {
    if (step === 0) {
      return Boolean(profile.fullName.trim() && profile.email.trim());
    }
    if (step === 1) {
      return Boolean(resumeFile || currentResume);
    }
    if (step === 2) {
      return questions.every((question) => (answers[question.id] || "").trim().length >= 20);
    }
    return true;
  }, [answers, currentResume, profile.email, profile.fullName, questions, resumeFile, step]);

  async function submitApplication(event: FormEvent) {
    event.preventDefault();

    setIsBusy(true);
    try {
      let fileForUpload = resumeFile;
      if (!fileForUpload && currentResume.startsWith("http")) {
        const response = await fetch(currentResume);
        if (response.ok) {
          const blob = await response.blob();
          fileForUpload = new File([blob], "resume.pdf", { type: "application/pdf" });
        }
      }
      if (!fileForUpload) {
        toast.error("Please upload your latest resume before submitting.");
        setStep(1);
        return;
      }

      const formData = new FormData();
      formData.append("job_id", jobId);
      formData.append("resume", fileForUpload);
      if (answers.impact) {
        formData.append("cover_letter", answers.impact);
      }

      const response = await fetch("/api/apply", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload?.error || "Unable to submit application.");
        return;
      }
      toast.success("Application submitted successfully.");
      router.push("/dashboard/applicant/applications");
    } catch {
      toast.error("Network issue while submitting application.");
    } finally {
      setIsBusy(false);
    }
  }

  const cleanJob = sanitizeJob(job || defaultJob);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="rounded-[2rem] border border-slate-200/70 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900/70 dark:shadow-slate-950/40">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Apply Flow</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{cleanJob.title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">{cleanJob.company}</p>
          </div>
          <Link href={`/jobs/${jobId}`} className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            Return to job details
          </Link>
        </div>

        <div className="mb-8 grid gap-2 sm:grid-cols-4">
          {steps.map((item, index) => {
            const active = step === index;
            const complete = step > index;
            return (
              <div
                key={item}
                className={`rounded-2xl border px-3 py-2 text-center text-xs font-semibold transition ${
                  active
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : complete
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {complete ? <CheckCircle2 className="mx-auto mb-1 h-4 w-4" /> : null}
                {item}
              </div>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <div className="h-12 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-12 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ) : (
          <form onSubmit={submitApplication} className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {step === 0 ? (
                  <>
                    <Field label="Full Name" value={profile.fullName} onChange={(value) => setProfile((prev) => ({ ...prev, fullName: value }))} />
                    <Field label="Email" type="email" value={profile.email} onChange={(value) => setProfile((prev) => ({ ...prev, email: value }))} />
                    <Field label="Phone" value={profile.phone} onChange={(value) => setProfile((prev) => ({ ...prev, phone: value }))} />
                    <Field label="Location" value={profile.location} onChange={(value) => setProfile((prev) => ({ ...prev, location: value }))} />
                  </>
                ) : null}

                {step === 1 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Resume Upload</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Use your existing resume or replace it with a new file.</p>
                    {currentResume ? (
                      <p className="mt-3 text-sm text-emerald-700">Current resume on file: {currentResume}</p>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">No resume currently saved.</p>
                    )}
                    <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                      <FileUp className="h-4 w-4 text-indigo-600" />
                      {resumeFile ? resumeFile.name : "Upload a PDF resume"}
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                ) : null}

                {step === 2 ? (
                  <>
                    {questions.map((question) => (
                      <div key={question.id} className="space-y-2">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{question.prompt}</p>
                        <textarea
                          value={answers[question.id] || ""}
                          onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}
                          rows={4}
                          placeholder="Write at least 20 characters..."
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none ring-indigo-200 transition focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                    ))}
                  </>
                ) : null}

                {step === 3 ? (
                  <div className="space-y-4">
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Review & Submit</p>
                    <ReviewRow label="Full Name" value={profile.fullName} />
                    <ReviewRow label="Email" value={profile.email} />
                    <ReviewRow label="Phone" value={profile.phone || "Not provided"} />
                    <ReviewRow label="Location" value={profile.location || "Not provided"} />
                    <ReviewRow label="Resume" value={resumeFile?.name || currentResume || "No resume selected"} />
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Additional Questions</p>
                      <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        {questions.map((question) => (
                          <li key={question.id}>{answers[question.id] || "No answer"}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setStep((prev) => Math.max(0, prev - 1))}
                disabled={step === 0 || isBusy}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>

              {step < steps.length - 1 ? (
                <Button type="button" className="rounded-xl hover:bg-indigo-600" onClick={() => setStep((prev) => Math.min(steps.length - 1, prev + 1))} disabled={!canProceed}>
                  Continue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" className="rounded-xl hover:bg-indigo-600" disabled={isBusy}>
                  {isBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Confirm Submission"
                  )}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none ring-indigo-200 transition focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-300">{label}</p>
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

const defaultJob: PublicJob = {
  id: "",
  title: "Product Engineer",
  description: "",
  created_at: new Date().toISOString(),
  company: "SmartHire",
  skills: [],
};
