import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/utils/supabase/server-env";

type Role = "applicant" | "hr" | "admin";

export async function POST(request: Request) {
  try {
    const { email, password, role, name } = await request.json();

    if (!email || !password || !role || !name) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const { supabaseUrl, supabaseKey } = getSupabaseServerEnv();

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase env is not configured." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: role as Role,
          name,
          isProfileComplete: role === "admin",
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
