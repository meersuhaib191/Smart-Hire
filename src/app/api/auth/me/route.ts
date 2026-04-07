import { NextResponse } from "next/server";
import { requireAuthUser, getAppRole } from "@/server/auth/session";

export async function GET() {
  try {
    const user = await requireAuthUser();
    const role = getAppRole(user);
    const isProfileComplete = Boolean(user.user_metadata?.isProfileComplete);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role,
        isProfileComplete,
        name: user.user_metadata?.name || "User",
        company: user.user_metadata?.company || "",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load auth user.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
