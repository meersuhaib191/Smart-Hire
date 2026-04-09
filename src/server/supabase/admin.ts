import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/utils/supabase/server-env";

export const createSupabaseAdmin = () => {
  const { supabaseUrl } = getSupabaseServerEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase server env. Set SUPABASE_SERVICE_ROLE_KEY and one URL var (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL)."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
};
