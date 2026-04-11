"use client";

import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type {
  EducationItem,
  ExperienceItem,
  HrProfessionalProfile,
  ProfileLink,
  ProfileLinkType,
} from "@/components/hr/profile/types";

const SKILL_SUGGESTIONS = [
  "Talent Acquisition",
  "Interviewing",
  "People Analytics",
  "Recruitment Operations",
  "Employer Branding",
  "Compensation Planning",
  "Candidate Experience",
  "Stakeholder Management",
  "Workforce Planning",
  "ATS Optimization",
];

type Props = {
  initial: HrProfessionalProfile;
  onCancel: () => void;
  onSaved: (profile: HrProfessionalProfile) => void;
};

const stripTags = (input: string) => String(input || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export function ProfileEditForm({ initial, onCancel, onSaved }: Props) {
  const [profile, setProfile] = useState<HrProfessionalProfile>(initial);
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [uploading, setUploading] = useState<"profile" | "cover" | "">("");
  const bioRef = useRef<HTMLDivElement | null>(null);
  const bioCount = stripTags(profile.bio).length;

  const skillSuggestions = useMemo(
    () =>
      SKILL_SUGGESTIONS.filter(
        (value) =>
          value.toLowerCase().includes(skillInput.toLowerCase()) &&
          !profile.skills.some((existing) => existing.toLowerCase() === value.toLowerCase())
      ).slice(0, 5),
    [profile.skills, skillInput]
  );

  const setLink = (index: number, next: Partial<ProfileLink>) => {
    setProfile((prev) => ({
      ...prev,
      links: prev.links.map((item, idx) => (idx === index ? { ...item, ...next } : item)),
    }));
  };

  const setExperience = (index: number, next: Partial<ExperienceItem>) => {
    setProfile((prev) => ({
      ...prev,
      experience: prev.experience.map((item, idx) => (idx === index ? { ...item, ...next } : item)),
    }));
  };

  const setEducation = (index: number, next: Partial<EducationItem>) => {
    setProfile((prev) => ({
      ...prev,
      education: prev.education.map((item, idx) => (idx === index ? { ...item, ...next } : item)),
    }));
  };

  const uploadMedia = async (file: File, kind: "profile" | "cover") => {
    setUploading(kind);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    const res = await fetch("/api/hr/profile/media", { method: "POST", body: formData });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error || "Upload failed.");
      setUploading("");
      return;
    }
    setProfile((prev) => ({
      ...prev,
      profilePicture: kind === "profile" ? json.path : prev.profilePicture,
      coverImage: kind === "cover" ? json.path : prev.coverImage,
      profilePictureUrl: kind === "profile" ? json.url : prev.profilePictureUrl,
      coverImageUrl: kind === "cover" ? json.url : prev.coverImageUrl,
    }));
    setUploading("");
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      companyName: profile.companyName,
      jobTitle: profile.jobTitle,
      phone: profile.phone,
      location: profile.location,
      website: profile.website,
      bio: profile.bio,
      profilePicture: profile.profilePicture,
      coverImage: profile.coverImage,
      links: profile.links,
      experience: profile.experience,
      education: profile.education,
      skills: profile.skills,
      visibilitySettings: profile.visibilitySettings,
      isProfileComplete: true,
    };
    const res = await fetch("/api/hr/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error || "Failed to save profile.");
      setSaving(false);
      return;
    }
    toast.success("Profile updated successfully.");
    onSaved({ ...profile, profileCompletionScore: Number(json.profile?.profileCompletionScore || profile.profileCompletionScore) });
    setSaving(false);
  };

  return (
    <div className="space-y-4 rounded-3xl border border-white/40 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/75">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Edit Professional Profile</h2>
        <Badge variant="secondary" className="rounded-full">{profile.profileCompletionScore}% complete</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Full Name
          <Tooltip>
            <TooltipTrigger asChild>
              <input
                value={profile.fullName}
                disabled
                className="mt-1 h-10 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 text-slate-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </TooltipTrigger>
            <TooltipContent sideOffset={8}>Name cannot be changed after account creation.</TooltipContent>
          </Tooltip>
        </label>
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Company Name
          <input
            value={profile.companyName}
            onChange={(e) => setProfile((prev) => ({ ...prev, companyName: e.target.value }))}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Job Title
          <input
            value={profile.jobTitle}
            onChange={(e) => setProfile((prev) => ({ ...prev, jobTitle: e.target.value }))}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Phone
          <input
            value={profile.phone}
            onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Location
          <input
            value={profile.location}
            onChange={(e) => setProfile((prev) => ({ ...prev, location: e.target.value }))}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Website
          <input
            value={profile.website}
            onChange={(e) => setProfile((prev) => ({ ...prev, website: e.target.value }))}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 p-3 dark:border-slate-700">
          <p className="text-sm font-medium">Profile Picture</p>
          {profile.profilePictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.profilePictureUrl} alt="Profile preview" className="mt-2 h-24 w-24 rounded-xl object-cover" />
          ) : null}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 text-xs" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadMedia(file, "profile");
          }} />
          <p className="mt-1 text-xs text-slate-500">{uploading === "profile" ? "Uploading..." : "Upload or replace"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 p-3 dark:border-slate-700">
          <p className="text-sm font-medium">Cover Image</p>
          {profile.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverImageUrl} alt="Cover preview" className="mt-2 h-24 w-full rounded-xl object-cover" />
          ) : null}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 text-xs" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadMedia(file, "cover");
          }} />
          <p className="mt-1 text-xs text-slate-500">{uploading === "cover" ? "Uploading..." : "Upload or replace"}</p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => document.execCommand("bold")}>Bold</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => document.execCommand("italic")}>Italic</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => document.execCommand("insertUnorderedList")}>List</Button>
        </div>
        <div
          ref={bioRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => setProfile((prev) => ({ ...prev, bio: (event.target as HTMLDivElement).innerHTML }))}
          className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          dangerouslySetInnerHTML={{ __html: profile.bio || "" }}
        />
        <p className="mt-1 text-xs text-slate-500">{bioCount}/1500 characters</p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 p-3 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Professional Links</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setProfile((prev) => ({
            ...prev,
            links: [...prev.links, { type: "linkedin", url: "" }],
          }))}>Add Link</Button>
        </div>
        <div className="space-y-2">
          {profile.links.map((link, index) => (
            <div key={`link-${index}`} className="grid grid-cols-[120px_1fr_auto] gap-2">
              <select
                value={link.type}
                onChange={(e) => setLink(index, { type: e.target.value as ProfileLinkType })}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="linkedin">LinkedIn</option>
                <option value="github">GitHub</option>
                <option value="portfolio">Portfolio</option>
                <option value="twitter">Twitter/X</option>
                <option value="other">Other</option>
              </select>
              <input
                value={link.url}
                onChange={(e) => setLink(index, { url: e.target.value })}
                placeholder="https://..."
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <Button type="button" size="sm" variant="outline" onClick={() => setProfile((prev) => ({
                ...prev,
                links: prev.links.filter((_, idx) => idx !== index),
              }))}>Remove</Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 p-3 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Experience</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setProfile((prev) => ({
            ...prev,
            experience: [...prev.experience, { role: "", company: "", start_date: "", end_date: "", description: "" }],
          }))}>Add Experience</Button>
        </div>
        <div className="space-y-3">
          {profile.experience.map((item, idx) => (
            <div key={`exp-${idx}`} className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-700">
              <div className="grid gap-2 md:grid-cols-2">
                <input value={item.role || ""} placeholder="Role" onChange={(e) => setExperience(idx, { role: e.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
                <input value={item.company || ""} placeholder="Company" onChange={(e) => setExperience(idx, { company: e.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
                <input value={item.start_date || ""} placeholder="Start date (YYYY-MM)" onChange={(e) => setExperience(idx, { start_date: e.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
                <input value={item.end_date || ""} placeholder="End date (or Present)" onChange={(e) => setExperience(idx, { end_date: e.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <textarea value={item.description || ""} placeholder="Description" onChange={(e) => setExperience(idx, { description: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setProfile((prev) => ({
                ...prev,
                experience: prev.experience.filter((_, i) => i !== idx),
              }))}>Delete</Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 p-3 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Education</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setProfile((prev) => ({
            ...prev,
            education: [...prev.education, { degree: "", institution: "", year: "", description: "" }],
          }))}>Add Education</Button>
        </div>
        <div className="space-y-3">
          {profile.education.map((item, idx) => (
            <div key={`edu-${idx}`} className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-700">
              <div className="grid gap-2 md:grid-cols-3">
                <input value={item.degree || ""} placeholder="Degree" onChange={(e) => setEducation(idx, { degree: e.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
                <input value={item.institution || ""} placeholder="Institution" onChange={(e) => setEducation(idx, { institution: e.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
                <input value={item.year || ""} placeholder="Year" onChange={(e) => setEducation(idx, { year: e.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <textarea value={item.description || ""} placeholder="Description" onChange={(e) => setEducation(idx, { description: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setProfile((prev) => ({
                ...prev,
                education: prev.education.filter((_, i) => i !== idx),
              }))}>Delete</Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 p-3 dark:border-slate-700">
        <p className="text-sm font-semibold">Skills</p>
        <div className="mt-2 flex gap-2">
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            placeholder="Add a skill"
            className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <Button type="button" size="sm" onClick={() => {
            const value = skillInput.trim();
            if (!value) return;
            if (profile.skills.some((skill) => skill.toLowerCase() === value.toLowerCase())) return;
            setProfile((prev) => ({ ...prev, skills: [...prev.skills, value] }));
            setSkillInput("");
          }}>Add</Button>
        </div>
        {skillSuggestions.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {skillSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                onClick={() => {
                  setProfile((prev) => ({ ...prev, skills: [...prev.skills, suggestion] }));
                  setSkillInput("");
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1">
          {profile.skills.map((skill) => (
            <span key={skill} className="rounded-full bg-indigo-100 px-2 py-1 text-xs text-indigo-700">
              {skill}
              <button
                type="button"
                className="ml-1"
                onClick={() => setProfile((prev) => ({ ...prev, skills: prev.skills.filter((item) => item !== skill) }))}
              >
                x
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 p-3 dark:border-slate-700">
        <p className="text-sm font-semibold">Visibility Settings</p>
        <div className="mt-2 space-y-2 text-sm">
          <label className="flex items-center justify-between">
            <span>Show phone</span>
            <Switch checked={profile.visibilitySettings.phone} onCheckedChange={(value) => setProfile((prev) => ({
              ...prev,
              visibilitySettings: { ...prev.visibilitySettings, phone: value },
            }))} />
          </label>
          <label className="flex items-center justify-between">
            <span>Show links</span>
            <Switch checked={profile.visibilitySettings.links} onCheckedChange={(value) => setProfile((prev) => ({
              ...prev,
              visibilitySettings: { ...prev.visibilitySettings, links: value },
            }))} />
          </label>
          <label className="flex items-center justify-between">
            <span>Public profile visible</span>
            <Switch checked={profile.visibilitySettings.profile} onCheckedChange={(value) => setProfile((prev) => ({
              ...prev,
              visibilitySettings: { ...prev.visibilitySettings, profile: value },
            }))} />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
