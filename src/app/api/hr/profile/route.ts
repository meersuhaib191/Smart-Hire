import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { getAppRole, requireAuthUser } from "@/server/auth/session";

type ProfileLink = {
  type: "linkedin" | "github" | "portfolio" | "twitter" | "other";
  url: string;
};

type ExperienceItem = {
  role: string;
  company: string;
  start_date?: string;
  end_date?: string;
  description?: string;
};

type EducationItem = {
  degree: string;
  institution: string;
  year?: string;
  description?: string;
};

type VisibilitySettings = {
  phone?: boolean;
  links?: boolean;
  profile?: boolean;
};

type HrProfilePayload = {
  fullName?: string;
  companyName: string;
  jobTitle?: string;
  phone?: string;
  location?: string;
  website?: string;
  bio?: string;
  profilePicture?: string;
  coverImage?: string;
  links?: ProfileLink[];
  experience?: ExperienceItem[];
  education?: EducationItem[];
  skills?: string[];
  visibilitySettings?: VisibilitySettings;
  isProfileComplete?: boolean;
};

const isMissingUsersProfileColumnsError = (message?: string) => {
  const value = (message || "").toLowerCase();
  return (
    value.includes("could not find the 'is_profile_complete' column") ||
    value.includes("could not find the 'profile' column") ||
    value.includes("column users.is_profile_complete does not exist") ||
    value.includes("column users.profile does not exist") ||
    value.includes('column "is_profile_complete" does not exist') ||
    value.includes('column "profile" does not exist')
  );
};

const mapRoleToDbEnum = (role: "hr" | "admin") => (role === "admin" ? "PLATFORM_ADMIN" : "HR");
const PROFILE_MEDIA_BUCKET = "profile-media";

const stripTags = (input: string) => String(input || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeLinks = (links: HrProfilePayload["links"]): ProfileLink[] =>
  (links || [])
    .map((item) => ({
      type: (item?.type || "other") as ProfileLink["type"],
      url: String(item?.url || "").trim(),
    }))
    .filter((item) => item.url.length > 0);

const normalizeExperience = (items: HrProfilePayload["experience"]): ExperienceItem[] =>
  (items || [])
    .map((item) => ({
      role: String(item?.role || "").trim(),
      company: String(item?.company || "").trim(),
      start_date: String(item?.start_date || "").trim(),
      end_date: String(item?.end_date || "").trim(),
      description: String(item?.description || "").trim(),
    }))
    .filter((item) => item.role || item.company);

const normalizeEducation = (items: HrProfilePayload["education"]): EducationItem[] =>
  (items || [])
    .map((item) => ({
      degree: String(item?.degree || "").trim(),
      institution: String(item?.institution || "").trim(),
      year: String(item?.year || "").trim(),
      description: String(item?.description || "").trim(),
    }))
    .filter((item) => item.degree || item.institution);

const normalizeSkills = (skills: HrProfilePayload["skills"]) =>
  [...new Set((skills || []).map((value) => String(value || "").trim()).filter(Boolean))].slice(0, 40);

const completionScore = (profile: {
  companyName: string;
  jobTitle: string;
  phone: string;
  location: string;
  website: string;
  bio: string;
  profilePicture: string;
  coverImage: string;
  links: ProfileLink[];
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
}) => {
  const checks = [
    Boolean(profile.companyName),
    Boolean(profile.jobTitle),
    Boolean(profile.phone),
    Boolean(profile.location),
    Boolean(profile.website),
    stripTags(profile.bio).length > 50,
    Boolean(profile.profilePicture),
    Boolean(profile.coverImage),
    profile.links.length > 0,
    profile.experience.length > 0,
    profile.education.length > 0,
    profile.skills.length >= 3,
  ];
  const hit = checks.filter(Boolean).length;
  return Math.round((hit / checks.length) * 100);
};

async function resolveMediaUrl(admin: ReturnType<typeof createSupabaseAdmin>, path?: string) {
  const value = String(path || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const { data, error } = await admin.storage.from(PROFILE_MEDIA_BUCKET).createSignedUrl(value, 60 * 60 * 24 * 7);
  if (error) return "";
  return data?.signedUrl || "";
}

export async function GET() {
  try {
    const user = await requireAuthUser();
    const role = getAppRole(user);
    if (role !== "hr" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const admin = createSupabaseAdmin();
    const { data: row, error } = await admin
      .from("users")
      .select("id, profile, is_profile_complete")
      .eq("id", user.id)
      .maybeSingle();

    if (error && !isMissingUsersProfileColumnsError(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const raw = (row?.profile || {}) as Record<string, unknown>;
    const normalizedLinks = normalizeLinks(raw.links as HrProfilePayload["links"]);
    const normalizedExperience = normalizeExperience(raw.experience as HrProfilePayload["experience"]);
    const normalizedEducation = normalizeEducation(raw.education as HrProfilePayload["education"]);
    const normalizedSkills = normalizeSkills(raw.skills as HrProfilePayload["skills"]);
    const profilePicture = String(raw.profilePicture || raw.profile_picture || "");
    const coverImage = String(raw.coverImage || raw.cover_image || "");
    const responseProfile = {
      fullName: String(raw.fullName || user.user_metadata?.name || ""),
      companyName: String(raw.companyName || ""),
      jobTitle: String(raw.jobTitle || ""),
      phone: String(raw.phone || ""),
      location: String(raw.location || ""),
      website: String(raw.website || ""),
      bio: String(raw.bio || ""),
      profilePicture,
      coverImage,
      profilePictureUrl: await resolveMediaUrl(admin, profilePicture),
      coverImageUrl: await resolveMediaUrl(admin, coverImage),
      links: normalizedLinks,
      experience: normalizedExperience,
      education: normalizedEducation,
      skills: normalizedSkills,
      visibilitySettings: {
        phone: Boolean((raw.visibilitySettings as VisibilitySettings | undefined)?.phone ?? true),
        links: Boolean((raw.visibilitySettings as VisibilitySettings | undefined)?.links ?? true),
        profile: Boolean((raw.visibilitySettings as VisibilitySettings | undefined)?.profile ?? true),
      },
      profileCompletionScore: Number(raw.profileCompletionScore || completionScore({
        companyName: String(raw.companyName || ""),
        jobTitle: String(raw.jobTitle || ""),
        phone: String(raw.phone || ""),
        location: String(raw.location || ""),
        website: String(raw.website || ""),
        bio: String(raw.bio || ""),
        profilePicture,
        coverImage,
        links: normalizedLinks,
        experience: normalizedExperience,
        education: normalizedEducation,
        skills: normalizedSkills,
      })),
    };

    return NextResponse.json({
      userId: row?.id || user.id,
      publicProfileUrl: `/hr/public/${row?.id || user.id}`,
      profile: responseProfile,
      isProfileComplete: row?.is_profile_complete ?? Boolean(user.user_metadata?.isProfileComplete),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load HR profile.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuthUser();
    const role = getAppRole(user);
    if (role !== "hr" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = (await request.json()) as HrProfilePayload;
    if (!user.email) {
      return NextResponse.json({ error: "User email is missing in auth profile." }, { status: 400 });
    }
    if (!body.companyName?.trim()) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }

    const normalizedLinks = normalizeLinks(body.links);
    const invalidLink = normalizedLinks.find((item) => !isValidHttpUrl(item.url));
    if (invalidLink) {
      return NextResponse.json({ error: `Invalid URL for ${invalidLink.type} link.` }, { status: 400 });
    }

    const normalizedExperience = normalizeExperience(body.experience);
    const normalizedEducation = normalizeEducation(body.education);
    const normalizedSkills = normalizeSkills(body.skills);

    const profile = {
      fullName: "",
      companyName: body.companyName.trim(),
      jobTitle: body.jobTitle || "",
      phone: body.phone || "",
      location: body.location || "",
      website: body.website || "",
      bio: body.bio || "",
      profilePicture: body.profilePicture || "",
      coverImage: body.coverImage || "",
      links: normalizedLinks,
      experience: normalizedExperience,
      education: normalizedEducation,
      skills: normalizedSkills,
      visibilitySettings: {
        phone: Boolean(body.visibilitySettings?.phone ?? true),
        links: Boolean(body.visibilitySettings?.links ?? true),
        profile: Boolean(body.visibilitySettings?.profile ?? true),
      },
      profileCompletionScore: 0,
    };

    const admin = createSupabaseAdmin();
    const { data: existing } = await admin.from("users").select("profile").eq("id", user.id).maybeSingle();
    const existingProfile = (existing?.profile || {}) as Record<string, unknown>;
    profile.fullName = String(existingProfile.fullName || body.fullName || user.user_metadata?.name || "").trim();
    profile.profileCompletionScore = completionScore({
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
    });
    const complete = Boolean(body.isProfileComplete ?? profile.profileCompletionScore >= 70);

    const usersUpsertBase = {
      id: user.id,
      email: user.email,
      role: mapRoleToDbEnum(role === "admin" ? "admin" : "hr"),
    };
    const { error: usersEnsureError } = await admin.from("users").upsert(usersUpsertBase, { onConflict: "id" });
    if (usersEnsureError) {
      return NextResponse.json({ error: usersEnsureError.message }, { status: 500 });
    }

    const { error: usersError } = await admin
      .from("users")
      .update({
        profile,
        is_profile_complete: complete,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (usersError && !isMissingUsersProfileColumnsError(usersError.message)) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const { error: profileError } = await admin
      .from("user_profiles")
      .upsert(
        {
          user_id: user.id,
          full_name: profile.fullName,
          location: profile.location || null,
          headline: profile.jobTitle || null,
        },
        { onConflict: "user_id" }
      );

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile,
      isProfileComplete: complete,
      compatibilityMode: Boolean(usersError && isMissingUsersProfileColumnsError(usersError.message)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save HR profile.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
