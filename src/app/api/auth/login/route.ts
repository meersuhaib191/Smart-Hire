import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/utils/supabase/server-env";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password." }, { status: 400 });
    }

    const { supabaseUrl, supabaseKey } = getSupabaseServerEnv();

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase env is not configured." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
