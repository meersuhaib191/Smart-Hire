import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser } from "@/server/auth/session";

type PasswordPayload = {
  newPassword?: string;
  confirmPassword?: string;
};

export async function PUT(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as PasswordPayload;
    const nextPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!nextPassword || nextPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    if (nextPassword !== confirmPassword) {
      return NextResponse.json({ error: "Password confirmation does not match." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: nextPassword,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update password.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
