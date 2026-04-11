import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser } from "@/server/auth/session";

export async function POST() {
  try {
    const user = await requireAuthUser();
    const admin = createSupabaseAdmin();
    const authAdmin = admin.auth.admin as unknown as {
      signOut?: (userId: string, scope?: "global" | "local" | "others") => Promise<{ error?: { message: string } }>;
      invalidateRefreshTokens?: (userId: string) => Promise<{ error?: { message: string } }>;
    };

    if (typeof authAdmin.signOut === "function") {
      const result = await authAdmin.signOut(user.id, "global");
      if (result?.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (typeof authAdmin.invalidateRefreshTokens === "function") {
      const result = await authAdmin.invalidateRefreshTokens(user.id);
      if (result?.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to logout all devices.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
