import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/utils/supabase/server-env";

type ResetPasswordPayload = {
  accessToken?: string;
  refreshToken?: string;
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
    const body = (await request.json()) as ResetPasswordPayload;
    const accessToken = String(body.accessToken || "");
    const refreshToken = String(body.refreshToken || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ error: "Missing reset session token." }, { status: 400 });
    }
    if (!newPassword || !confirmPassword) {
      return NextResponse.json({ error: "Please provide and confirm a new password." }, { status: 400 });
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

    const client = createClient(supabaseUrl, supabaseKey);
    const session = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (session.error) {
      return NextResponse.json({ error: "Reset token is invalid or expired." }, { status: 401 });
    }

    const result = await client.auth.updateUser({ password: newPassword });
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset password.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
