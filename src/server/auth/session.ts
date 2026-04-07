import { User } from "@supabase/supabase-js";
import { createSupabaseRouteClient } from "@/utils/supabase/route-client";

export async function requireAuthUser(): Promise<User> {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export function getAppRole(user: User): "applicant" | "hr" | "admin" {
  const raw = (user.user_metadata?.role as string) || "applicant";
  if (raw === "hr" || raw === "admin" || raw === "applicant") return raw;
  return "applicant";
}

export function requireHr(user: User) {
  const role = getAppRole(user);
  if (role !== "hr" && role !== "admin") {
    throw new Error("Forbidden");
  }
}
