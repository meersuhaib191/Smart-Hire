"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ProfileEditForm } from "@/components/hr/profile/ProfileEditForm";
import { ProfileViewCard } from "@/components/hr/profile/ProfileViewCard";
import { EMPTY_HR_PROFILE, HrProfessionalProfile } from "@/components/hr/profile/types";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { useStore } from "@/store/useStore";

export default function HrSettingsPage() {
  const { user } = useStore();
  const [profile, setProfile] = useState<HrProfessionalProfile>(EMPTY_HR_PROFILE);
  const [publicProfileUrl, setPublicProfileUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <div className="app-card p-6">
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

      <SettingsPage email={user?.email || ""} />
    </div>
  );
}
