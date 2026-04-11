import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";

const PROFILE_MEDIA_BUCKET = "profile-media";

async function signed(admin: ReturnType<typeof createSupabaseAdmin>, path?: string) {
  const value = String(path || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const { data, error } = await admin.storage.from(PROFILE_MEDIA_BUCKET).createSignedUrl(value, 60 * 60 * 24 * 7);
  if (error) return "";
  return data?.signedUrl || "";
}

export async function GET(_request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await context.params;
    const admin = createSupabaseAdmin();
    const { data: row, error } = await admin.from("users").select("id, profile").eq("id", userId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    const profile = (row.profile || {}) as Record<string, unknown>;
    const visibility = (profile.visibilitySettings || {}) as Record<string, unknown>;
    if (visibility.profile === false) {
      return NextResponse.json({ error: "Profile is private." }, { status: 403 });
    }

    const links = Array.isArray(profile.links) ? profile.links : [];
    const phone = visibility.phone === false ? "" : String(profile.phone || "");
    const visibleLinks = visibility.links === false ? [] : links;

    return NextResponse.json({
      id: row.id,
      profile: {
        fullName: String(profile.fullName || ""),
        companyName: String(profile.companyName || ""),
        jobTitle: String(profile.jobTitle || ""),
        phone,
        location: String(profile.location || ""),
        website: String(profile.website || ""),
        bio: String(profile.bio || ""),
        profilePictureUrl: await signed(admin, String(profile.profilePicture || profile.profile_picture || "")),
        coverImageUrl: await signed(admin, String(profile.coverImage || profile.cover_image || "")),
        links: visibleLinks,
        experience: Array.isArray(profile.experience) ? profile.experience : [],
        education: Array.isArray(profile.education) ? profile.education : [],
        skills: Array.isArray(profile.skills) ? profile.skills : [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load public profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
