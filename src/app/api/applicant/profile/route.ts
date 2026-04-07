import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, getAppRole } from "@/server/auth/session";

type ProfilePayload = {
  fullName: string;
  phone?: string;
  location?: string;
  skills?: string[];
  experienceYears?: number;
  experienceSummary?: string;
  education?: string;
  resumeUrl?: string;
  linkedin?: string;
  portfolio?: string;
  bio?: string;
  isProfileComplete?: boolean;
};

const isMissingUsersProfileColumnsError = (message?: string) =>
  (message || "").includes("Could not find the 'is_profile_complete' column") ||
  (message || "").includes("Could not find the 'profile' column");

export async function GET() {
  try {
    const user = await requireAuthUser();
    if (getAppRole(user) !== "applicant") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const admin = createSupabaseAdmin();
    const { data: row, error } = await admin
      .from("users")
      .select("profile, is_profile_complete")
      .eq("id", user.id)
      .maybeSingle();

    if (error && !isMissingUsersProfileColumnsError(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      profile: row?.profile || {},
      isProfileComplete: row?.is_profile_complete ?? Boolean(user.user_metadata?.isProfileComplete),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load profile.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuthUser();
    if (getAppRole(user) !== "applicant") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = (await request.json()) as ProfilePayload;
    if (!user.email) {
      return NextResponse.json({ error: "User email is missing in auth profile." }, { status: 400 });
    }
    if (!body.fullName?.trim()) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }

    const profile = {
      fullName: body.fullName.trim(),
      phone: body.phone || "",
      location: body.location || "",
      skills: body.skills || [],
      experienceYears: Number(body.experienceYears || 0),
      experienceSummary: body.experienceSummary || "",
      education: body.education || "",
      resumeUrl: body.resumeUrl || "",
      linkedin: body.linkedin || "",
      portfolio: body.portfolio || "",
      bio: body.bio || "",
    };

    const admin = createSupabaseAdmin();
    const complete = Boolean(body.isProfileComplete);

    const usersUpsertBase = {
      id: user.id,
      email: user.email,
      role: "APPLICANT" as const,
    };
    const { error: usersEnsureError } = await admin.from("users").upsert(usersUpsertBase, { onConflict: "id" });
    if (usersEnsureError) {
      return NextResponse.json({ error: usersEnsureError.message }, { status: 500 });
    }

    const { error: usersError } = await admin
      .from("users")
      .update({
        is_profile_complete: complete,
        profile,
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
          headline: profile.experienceSummary || null,
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
    const message = error instanceof Error ? error.message : "Failed to save profile.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
