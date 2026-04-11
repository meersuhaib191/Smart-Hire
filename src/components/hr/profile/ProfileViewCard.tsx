"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/progress";
import type { HrProfessionalProfile } from "@/components/hr/profile/types";

type Props = {
  profile: HrProfessionalProfile;
  publicProfileUrl: string;
  onEdit: () => void;
};

export function ProfileViewCard({ profile, publicProfileUrl, onEdit }: Props) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-white/40 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
        <div className="h-36 bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-500">
          {profile.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverImageUrl} alt="Cover" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="p-5">
          <div className="-mt-14 flex items-end justify-between">
            <div className="flex items-end gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-slate-100 dark:border-slate-900 dark:bg-slate-800">
                {profile.profilePictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profilePictureUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{profile.fullName}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  {profile.jobTitle || "HR"} at {profile.companyName || "Company"}
                </p>
              </div>
            </div>
            <Button onClick={onEdit} className="rounded-2xl">
              Edit Profile
            </Button>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{profile.bio || "No bio yet."}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-slate-100/80 p-3 text-sm dark:bg-slate-800/80">
              <p className="text-slate-500">Phone</p>
              <p className="font-medium">{profile.visibilitySettings.phone ? profile.phone || "Not provided" : "Hidden"}</p>
            </div>
            <div className="rounded-xl bg-slate-100/80 p-3 text-sm dark:bg-slate-800/80">
              <p className="text-slate-500">Location</p>
              <p className="font-medium">{profile.location || "Not provided"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/40 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Profile Completeness</p>
          <Badge variant="secondary" className="rounded-full">{profile.profileCompletionScore}%</Badge>
        </div>
        <Progress className="mt-2 h-2" value={profile.profileCompletionScore} />
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">Public URL: {publicProfileUrl}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/40 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Experience</p>
          <div className="mt-3 space-y-2">
            {profile.experience.length ? (
              profile.experience.map((item, idx) => (
                <div key={`${item.role}-${idx}`} className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-700">
                  <p className="font-medium">{item.role} · {item.company}</p>
                  <p className="text-xs text-slate-500">{item.start_date || ""} - {item.end_date || "Present"}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description || ""}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No experience entries.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/40 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Skills</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.skills.length ? (
              profile.skills.map((skill) => (
                <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-500">No skills added.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
