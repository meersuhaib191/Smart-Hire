import { NextResponse } from "next/server";
import { requireAuthUser } from "@/server/auth/session";
import { createSupabaseAdmin } from "@/server/supabase/admin";

const isMissingNotificationsTable = (message?: string) =>
  (message || "").includes("relation \"user_notifications\" does not exist") ||
  (message || "").includes("relation \"public.user_notifications\" does not exist") ||
  (message || "").includes("Could not find the table 'user_notifications'") ||
  (message || "").includes("Could not find the table 'public.user_notifications'") ||
  (message || "").includes("Could not find the 'user_notifications' relation") ||
  (message || "").includes("Could not find the 'public.user_notifications' relation");

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || 8)));
    const unreadOnly = url.searchParams.get("unread") === "1";
    const typeFilter = String(url.searchParams.get("type") || "").toLowerCase();
    const admin = createSupabaseAdmin();

    let query = admin
      .from("user_notifications")
      .select("id, title, message, route, type, is_read, created_at, application_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (unreadOnly) {
      query = query.eq("is_read", false);
    }
    if (typeFilter) {
      query = query.eq("type", typeFilter);
    }

    const { data, error } = await query;

    if (isMissingNotificationsTable(error?.message)) {
      return NextResponse.json({ unread: 0, items: [] });
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count: unreadCount, error: unreadError } = await admin
      .from("user_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (isMissingNotificationsTable(unreadError?.message)) {
      return NextResponse.json({ unread: 0, items: data || [] });
    }
    if (unreadError) {
      return NextResponse.json({ error: unreadError.message }, { status: 500 });
    }

    const items = data || [];
    return NextResponse.json({
      unread: unreadCount ?? 0,
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load notifications.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json().catch(() => ({}))) as { id?: string; markAll?: boolean };
    const admin = createSupabaseAdmin();

    if (body.markAll) {
      const { error } = await admin
        .from("user_notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (isMissingNotificationsTable(error?.message)) {
        return NextResponse.json({ success: true });
      }
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (!body.id) {
      return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
    }

    const { error } = await admin
      .from("user_notifications")
      .update({ is_read: true })
      .eq("id", body.id)
      .eq("user_id", user.id);
    if (isMissingNotificationsTable(error?.message)) {
      return NextResponse.json({ success: true });
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update notification.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
