"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/utils/supabase/client";
import { toast } from "sonner";

type WizardMode = "onboarding" | "manage";

type HrFormState = {
  fullName: string;
  email: string;
  companyName: string;
  jobTitle: string;
  phone: string;
  location: string;
  website: string;
  bio: string;
};

const initialState: HrFormState = {
  fullName: "",
  email: "",
  companyName: "",
  jobTitle: "",
  phone: "",
  location: "",
  website: "",
  bio: "",
};

export function HrProfileWizard({ mode }: { mode: WizardMode }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<HrFormState>(initialState);
  const storageKey = mode === "onboarding" ? "hr-profile-onboarding-draft" : "hr-profile-manage-draft";

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        const meJson = await meRes.json();
        const user = meJson?.user || {};

        const profileRes = await fetch("/api/hr/profile");
        const profileJson = await profileRes.json();
        const server = profileJson?.profile || {};

        const persisted = window.localStorage.getItem(storageKey);
        const draft = persisted ? (JSON.parse(persisted) as Partial<HrFormState>) : {};

        setForm((prev) => ({
          ...prev,
          fullName: server.fullName || user.name || "",
          email: user.email || "",
          companyName: server.companyName || user.company || "",
          jobTitle: server.jobTitle || "",
          phone: server.phone || "",
          location: server.location || "",
          website: server.website || "",
          bio: server.bio || "",
          ...draft,
        }));
      } catch {
        // Allow user to continue filling form even if preload fails.
      } finally {
        setLoading(false);
      }
    })();
  }, [storageKey]);

  useEffect(() => {
    if (loading) return;
    window.localStorage.setItem(storageKey, JSON.stringify(form));
  }, [form, loading, storageKey]);

  const save = async (complete: boolean) => {
    if (!form.fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }
    if (!form.companyName.trim()) {
      toast.error("Company name is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/hr/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          isProfileComplete: complete,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save HR profile.");
      }

      await supabase.auth.updateUser({
        data: {
          isProfileComplete: complete,
          company: form.companyName.trim(),
          name: form.fullName.trim(),
        },
      });

      if (complete) {
        window.localStorage.removeItem(storageKey);
      }

      toast.success(complete ? "Profile completed successfully." : "Profile saved.");
      if (complete && mode === "onboarding") {
        window.location.href = "/hr/dashboard";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save HR profile.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading profile...</p>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {mode === "onboarding" ? "Complete your HR profile" : "Manage HR profile"}
        </h1>
        <p className="text-sm text-slate-500">
          {mode === "onboarding"
            ? "Add your company and role details before posting jobs and reviewing candidates."
            : "Keep your HR profile and company details up to date."}
        </p>
      </div>

      <Card className="rounded-2xl border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>These details are used across job postings and recruiter workflows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full Name" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
            <Input label="Work Email" value={form.email} disabled />
            <Input
              label="Company Name"
              value={form.companyName}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
              placeholder="Acme Inc."
            />
            <Input
              label="Job Title"
              value={form.jobTitle}
              onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
              placeholder="Talent Acquisition Lead"
            />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            <Input label="Location" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
          </div>

          <Input
            label="Company Website"
            value={form.website}
            onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
            placeholder="https://company.com"
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Team / Hiring Notes</label>
            <Textarea
              className="min-h-24"
              value={form.bio}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              placeholder="Tell us about your hiring focus, team, or current openings."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => save(false)} disabled={saving}>
              Save Draft
            </Button>
            <Button type="button" onClick={() => save(true)} isLoading={saving}>
              {mode === "onboarding" ? "Complete Profile" : "Save Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
