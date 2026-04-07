import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const projectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
const configuredAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseUrl =
  configuredUrl && !configuredUrl.includes("your-project.supabase.co")
    ? configuredUrl
    : projectId
      ? `https://${projectId}.supabase.co`
      : "";
const supabaseKey =
  configuredAnonKey && configuredAnonKey !== "your-anon-key" && configuredAnonKey !== "your_anon_key"
    ? configuredAnonKey
    : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";

export const createClient = (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  return supabaseResponse;
};
