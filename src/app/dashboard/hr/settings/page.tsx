"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ProfileEditForm } from "@/components/hr/profile/ProfileEditForm";
import { ProfileViewCard } from "@/components/hr/profile/ProfileViewCard";
import { EMPTY_HR_PROFILE, HrProfessionalProfile } from "@/components/hr/profile/types";

export default function HrSettingsPage() {
  const [profile, setProfile] = useState<HrProfessionalProfile>(EMPTY_HR_PROFILE);
  const [publicProfileUrl, setPublicProfileUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/hr/profile", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setProfile({ ...EMPTY_HR_PROFILE, ...(json.profile || {}) });
        const origin = window.location.origin;
        setPublicProfileUrl(`${origin}${json.publicProfileUrl || `/hr/public/${json.userId}`}`);
      }
      setLoading(false);
    })();
  }, []);

  const updatePassword = async () => {
    setSavingPassword(true);
    const res = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(passwordForm),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      toast.success("Password updated successfully.");
    } else {
      toast.error(json.error || "Failed to update password.");
    }
    setSavingPassword(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/40 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Professional Profile</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              LinkedIn-style structured profile for recruiter identity and credibility.
            </p>
          </div>
          {publicProfileUrl ? (
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={async () => {
                await navigator.clipboard.writeText(publicProfileUrl);
                toast.success("Public profile URL copied.");
              }}
            >
              Copy Public URL
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
          Loading profile settings...
        </div>
      ) : isEditing ? (
        <ProfileEditForm
          initial={profile}
          onCancel={() => setIsEditing(false)}
          onSaved={(next) => {
            setProfile(next);
            setIsEditing(false);
          }}
        />
      ) : (
        <ProfileViewCard profile={profile} publicProfileUrl={publicProfileUrl} onEdit={() => setIsEditing(true)} />
      )}

      <div className="rounded-2xl border border-white/40 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Security</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Update your account password.</p>

          <div className="mt-4 space-y-3">
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              New password
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Confirm password
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          </div>

          <Button onClick={updatePassword} disabled={savingPassword} className="mt-4 w-full rounded-2xl">
            {savingPassword ? "Updating..." : "Update password"}
          </Button>
      </div>
    </div>
  );
}
