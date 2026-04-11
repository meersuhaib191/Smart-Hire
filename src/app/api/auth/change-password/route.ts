import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser } from "@/server/auth/session";
import { getSupabaseServerEnv } from "@/utils/supabase/server-env";

type ChangePasswordPayload = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

const passwordStrengthScore = (value: string) => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
};

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    if (!user.email) {
      return NextResponse.json({ error: "User email is missing." }, { status: 400 });
    }

    const body = (await request.json()) as ChangePasswordPayload;
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: "All password fields are required." }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "New password and confirmation do not match." }, { status: 400 });
    }
    if (passwordStrengthScore(newPassword) < 4) {
      return NextResponse.json(
        {
          error:
            "Password is too weak. Use at least 8 characters including uppercase, lowercase, number, and symbol.",
        },
        { status: 400 }
      );
    }

    const { supabaseUrl, supabaseKey } = getSupabaseServerEnv();
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase env is not configured." }, { status: 500 });
    }

    const auth = createClient(supabaseUrl, supabaseKey);
    const verify = await auth.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verify.error) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to change password.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
