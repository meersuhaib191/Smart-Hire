import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServerEnv } from "@/utils/supabase/server-env";
import { normalizeRole } from "@/server/auth/session";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const { supabaseUrl, supabaseKey } = getSupabaseServerEnv();
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const isDashboardRoute = path.startsWith("/dashboard");
  const isApplicantRoute = path.startsWith("/applicant");
  const isHrRoute = path.startsWith("/hr");

  if (isDashboardRoute || isApplicantRoute || isHrRoute) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }

    const role = normalizeRole(user.user_metadata?.role as string);
    const isProfileComplete = Boolean(user.user_metadata?.isProfileComplete);
    const hasCompany = String(user.user_metadata?.company || "").trim().length > 0;
    const isOnApplicantProfileFlow = path.startsWith("/applicant/complete-profile");
    const isOnHrProfileFlow = path.startsWith("/hr/complete-profile");

    const applicantNeedsProfile = role === "applicant" && !isProfileComplete;
    const hrNeedsProfile = role === "hr" && (!isProfileComplete || !hasCompany);

    if (applicantNeedsProfile || hrNeedsProfile) {
      if (applicantNeedsProfile && !isOnApplicantProfileFlow) {
        const url = request.nextUrl.clone();
        url.pathname = "/applicant/complete-profile";
        return NextResponse.redirect(url);
      }
      if (hrNeedsProfile && !isOnHrProfileFlow) {
        const url = request.nextUrl.clone();
        url.pathname = "/hr/complete-profile";
        return NextResponse.redirect(url);
      }
    }

    if ((path.startsWith("/dashboard/hr") || isHrRoute) && role !== "hr" && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/applicant/dashboard";
      return NextResponse.redirect(url);
    }

    if (path.startsWith("/dashboard/applicants") && role !== "hr" && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/applicant/dashboard";
      return NextResponse.redirect(url);
    }

    if (isApplicantRoute && role !== "applicant") {
      const url = request.nextUrl.clone();
      url.pathname = "/hr/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
