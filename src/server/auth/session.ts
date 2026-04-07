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

export function normalizeRole(rawRole?: string): "applicant" | "hr" | "admin" {
  const raw = (rawRole || "").toLowerCase();
  if (raw === "hr") return "hr";
  if (raw === "admin" || raw === "platform_admin" || raw === "company_admin") return "admin";
  return "applicant";
}

export function getAppRole(user: User): "applicant" | "hr" | "admin" {
  return normalizeRole(user.user_metadata?.role as string);
}

export function requireHr(user: User) {
  const role = getAppRole(user);
  if (role !== "hr" && role !== "admin") {
    throw new Error("Forbidden");
  }
}
