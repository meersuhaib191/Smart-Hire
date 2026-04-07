/**
 * Resolves Supabase URL + anon/publishable key for API routes.
 * Ignores placeholder env values that may override .env.local globally.
 */
export function getSupabaseServerEnv(): { supabaseUrl: string; supabaseKey: string } {
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

  return { supabaseUrl, supabaseKey };
}
