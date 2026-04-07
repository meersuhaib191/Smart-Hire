import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/utils/supabase/server-env";

type Role = "applicant" | "hr" | "admin";

const mapRoleToDbEnum = (role: Role) => {
  switch (role) {
    case "hr":
      return "HR";
    case "admin":
      return "PLATFORM_ADMIN";
    case "applicant":
    default:
      return "APPLICANT";
  }
};

export async function POST(request: Request) {
  try {
    const { supabaseUrl, supabaseKey: anonKey } = getSupabaseServerEnv();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        {
          error:
            "Missing Supabase URL or anon/publishable key. Set NEXT_PUBLIC_SUPABASE_PROJECT_ID (or URL) and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY).",
        },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token." }, { status: 401 });
    }

    const payload = await request.json();
    const userId = payload?.userId as string;
    const email = payload?.email as string;
    const role = payload?.role as Role;
    const name = payload?.name as string;

    if (!userId || !email || !role || !name) {
      return NextResponse.json({ error: "Missing required payload fields." }, { status: 400 });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Invalid user token." }, { status: 401 });
    }

    if (authData.user.id !== userId || authData.user.email !== email) {
      return NextResponse.json({ error: "Token does not match requested user." }, { status: 403 });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const rowUsers = {
      id: userId,
      email,
      role: mapRoleToDbEnum(role),
    };
    const rowProfile = {
      user_id: userId,
      full_name: name,
    };

    let usersError = (await userClient.from("users").upsert(rowUsers, { onConflict: "id" })).error;
    let profilesError = (await userClient.from("user_profiles").upsert(rowProfile, { onConflict: "user_id" }))
      .error;

    if ((usersError || profilesError) && serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      usersError = (await admin.from("users").upsert(rowUsers, { onConflict: "id" })).error;
      profilesError = (await admin.from("user_profiles").upsert(rowProfile, { onConflict: "user_id" })).error;
    }

    if (usersError || profilesError) {
      const msg = [usersError, profilesError]
        .filter(Boolean)
        .map((e) => e!.message)
        .join(" | ");

      return NextResponse.json({
        success: true,
        synced: false,
        warning:
          "Could not sync public.users / user_profiles (RLS or permissions). Add SUPABASE_SERVICE_ROLE_KEY for server sync, or add RLS policies. Login will still work.",
        detail: msg,
      });
    }

    return NextResponse.json({ success: true, synced: true });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
