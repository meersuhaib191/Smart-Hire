import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component. Middleware refresh handles session.
        }
      },
    },
  });
};
