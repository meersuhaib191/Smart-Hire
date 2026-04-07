import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseServerEnv } from "@/utils/supabase/server-env";

export async function createSupabaseRouteClient() {
  const { supabaseUrl, supabaseKey } = getSupabaseServerEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // ignore when called outside mutable context
        }
      },
    },
  });
}
