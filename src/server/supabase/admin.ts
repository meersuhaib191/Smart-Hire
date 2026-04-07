import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/utils/supabase/server-env";

export const createSupabaseAdmin = () => {
  const { supabaseUrl } = getSupabaseServerEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or Supabase URL. ATS write operations require service role."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
};
