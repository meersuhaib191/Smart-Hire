import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/utils/supabase/server-env";

type ForgotPasswordPayload = {
  email?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ForgotPasswordPayload;
    const email = String(body.email || "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please provide a valid email." }, { status: 400 });
    }

    const { supabaseUrl, supabaseKey } = getSupabaseServerEnv();
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase env is not configured." }, { status: 500 });
    }

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "";

    const client = createClient(supabaseUrl, supabaseKey);
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: origin ? `${origin}/reset-password` : undefined,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send reset link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
