"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type HrProfile = {
  fullName: string;
  companyName: string;
  jobTitle: string;
  phone: string;
  location: string;
  website: string;
  bio: string;
};

const emptyProfile: HrProfile = {
  fullName: "",
  companyName: "",
  jobTitle: "",
  phone: "",
  location: "",
  website: "",
  bio: "",
};

export default function HrSettingsPage() {
  const [profile, setProfile] = useState<HrProfile>(emptyProfile);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/hr/profile", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setProfile({
          fullName: String(json.profile?.fullName || ""),
          companyName: String(json.profile?.companyName || ""),
          jobTitle: String(json.profile?.jobTitle || ""),
          phone: String(json.profile?.phone || ""),
          location: String(json.profile?.location || ""),
          website: String(json.profile?.website || ""),
          bio: String(json.profile?.bio || ""),
        });
        setIsProfileComplete(Boolean(json.isProfileComplete));
      }
      setLoading(false);
    })();
  }, []);

  const updateProfileField = (key: keyof HrProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setMessage("");
    const res = await fetch("/api/hr/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...profile,
        isProfileComplete: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setIsProfileComplete(true);
      setMessage("Profile saved successfully.");
    } else {
      setMessage(json.error || "Failed to save profile.");
    }
    setSavingProfile(false);
  };

  const updatePassword = async () => {
    setSavingPassword(true);
    setMessage("");
    const res = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(passwordForm),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      setMessage("Password updated successfully.");
    } else {
      setMessage(json.error || "Failed to update password.");
    }
    setSavingPassword(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/40 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Settings</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              Manage HR profile, company details, and account security.
            </p>
          </div>
          <Badge variant={isProfileComplete ? "success" : "warning"} className="rounded-full">
            {isProfileComplete ? "Profile complete" : "Profile incomplete"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/40 bg-white/80 p-5 shadow-sm backdrop-blur lg:col-span-2 dark:border-white/10 dark:bg-slate-900/70"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">HR Profile</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Keep recruiter identity and contact details up to date.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Full name
              <input
                value={profile.fullName}
                onChange={(e) => updateProfileField("fullName", e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Company name
              <input
                value={profile.companyName}
                onChange={(e) => updateProfileField("companyName", e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Job title
              <input
                value={profile.jobTitle}
                onChange={(e) => updateProfileField("jobTitle", e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Phone
              <input
                value={profile.phone}
                onChange={(e) => updateProfileField("phone", e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Location
              <input
                value={profile.location}
                onChange={(e) => updateProfileField("location", e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Website
              <input
                value={profile.website}
                onChange={(e) => updateProfileField("website", e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          </div>
          <label className="mt-3 block text-sm text-slate-600 dark:text-slate-300">
            Bio
            <textarea
              rows={4}
              value={profile.bio}
              onChange={(e) => updateProfileField("bio", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <div className="mt-4 flex justify-end">
            <Button onClick={saveProfile} disabled={savingProfile} className="rounded-2xl">
              {savingProfile ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/40 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/70"
        >
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
        </motion.div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
          Loading profile settings...
        </div>
      ) : null}
    </div>
  );
}
