"use client";

import { useEffect, useState } from "react";

type PublicProfileResponse = {
  profile?: {
    fullName: string;
    companyName: string;
    jobTitle: string;
    phone?: string;
    location?: string;
    website?: string;
    bio?: string;
    profilePictureUrl?: string;
    coverImageUrl?: string;
    links?: Array<{ type: string; url: string }>;
    experience?: Array<{ role: string; company: string; start_date?: string; end_date?: string; description?: string }>;
    education?: Array<{ degree: string; institution: string; year?: string; description?: string }>;
    skills?: string[];
  };
  error?: string;
};

export default function HrPublicProfilePage({ params }: { params: { userId: string } }) {
  const [payload, setPayload] = useState<PublicProfileResponse>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const response = await fetch(`/api/public/hr/${params.userId}`, { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as PublicProfileResponse;
      setPayload(json);
      setLoading(false);
    })();
  }, [params.userId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <p className="text-sm text-slate-500">Loading profile...</p>
      </div>
    );
  }

  if (!payload.profile) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <h1 className="text-2xl font-semibold">Profile unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">{payload.error || "This profile is private or does not exist."}</p>
      </div>
    );
  }

  const profile = payload.profile;
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="h-40 bg-gradient-to-r from-indigo-500 to-violet-500">
          {profile.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverImageUrl} alt="cover" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="p-5">
          <div className="-mt-16 flex items-end gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-slate-100">
              {profile.profilePictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.profilePictureUrl} alt="profile" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{profile.fullName}</h1>
              <p className="text-sm text-slate-500">{profile.jobTitle} at {profile.companyName}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">{profile.bio}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold">Experience</p>
          <div className="mt-2 space-y-2">
            {(profile.experience || []).map((item, idx) => (
              <div key={`${item.role}-${idx}`} className="rounded-xl border border-slate-200 p-3">
                <p className="font-medium">{item.role} · {item.company}</p>
                <p className="text-xs text-slate-500">{item.start_date || ""} - {item.end_date || "Present"}</p>
                <p className="mt-1 text-sm text-slate-600">{item.description || ""}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold">Education</p>
          <div className="mt-2 space-y-2">
            {(profile.education || []).map((item, idx) => (
              <div key={`${item.degree}-${idx}`} className="rounded-xl border border-slate-200 p-3">
                <p className="font-medium">{item.degree}</p>
                <p className="text-sm text-slate-600">{item.institution} · {item.year || ""}</p>
                <p className="mt-1 text-sm text-slate-600">{item.description || ""}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold">Skills</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(profile.skills || []).map((skill) => (
              <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{skill}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
