import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { getAppRole, requireAuthUser } from "@/server/auth/session";

const PROFILE_MEDIA_BUCKET = "profile-media";
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

async function ensureBucket(admin: ReturnType<typeof createSupabaseAdmin>) {
  const { data: buckets } = await admin.storage.listBuckets();
  const exists = (buckets || []).some((bucket) => bucket.name === PROFILE_MEDIA_BUCKET);
  if (exists) return;
  await admin.storage.createBucket(PROFILE_MEDIA_BUCKET, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ALLOWED_MIME,
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const role = getAppRole(user);
    if (role !== "hr" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") || "profile");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: "Only PNG, JPG, or WEBP images are allowed." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Maximum upload size is 5MB." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    await ensureBucket(admin);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${kind}-${Date.now()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from(PROFILE_MEDIA_BUCKET)
      .upload(path, buffer, { upsert: true, contentType: file.type });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: signed } = await admin.storage.from(PROFILE_MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    return NextResponse.json({
      success: true,
      path,
      url: signed?.signedUrl || "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
