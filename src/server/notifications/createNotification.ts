import { createSupabaseAdmin } from "@/server/supabase/admin";

type NotificationInput = {
  userId: string;
  applicationId?: string;
  title: string;
  message: string;
  route?: string;
  type?: "info" | "mcq" | "coding" | "interview";
};

const isMissingNotificationsTable = (message?: string) =>
  (message || "").includes("relation \"user_notifications\" does not exist") ||
  (message || "").includes("relation \"public.user_notifications\" does not exist") ||
  (message || "").includes("Could not find the table 'user_notifications'") ||
  (message || "").includes("Could not find the table 'public.user_notifications'") ||
  (message || "").includes("Could not find the 'user_notifications' relation") ||
  (message || "").includes("Could not find the 'public.user_notifications' relation");

export async function createUserNotification(admin: ReturnType<typeof createSupabaseAdmin>, input: NotificationInput) {
  const { error } = await admin.from("user_notifications").insert({
    user_id: input.userId,
    application_id: input.applicationId || null,
    title: input.title,
    message: input.message,
    route: input.route || null,
    type: input.type || "info",
    is_read: false,
  });

  if (isMissingNotificationsTable(error?.message)) {
    // Keep stage movement non-blocking when migration hasn't been applied yet.
    return;
  }
  if (error) {
    console.warn("createUserNotification failed:", error.message);
  }
}
