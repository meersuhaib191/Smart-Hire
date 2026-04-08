import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { getAppRole, requireAuthUser } from "@/server/auth/session";

type HrProfilePayload = {
  fullName: string;
  companyName: string;
  jobTitle?: string;
  phone?: string;
  location?: string;
  website?: string;
  bio?: string;
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
    if (!body.fullName?.trim()) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }
    if (!body.companyName?.trim()) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }

    const profile = {
      fullName: body.fullName.trim(),
      companyName: body.companyName.trim(),
      jobTitle: body.jobTitle || "",
      phone: body.phone || "",
      location: body.location || "",
      website: body.website || "",
      bio: body.bio || "",
    };
    const complete = Boolean(body.isProfileComplete);

    const admin = createSupabaseAdmin();
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
