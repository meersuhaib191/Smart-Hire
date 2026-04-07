import { createSupabaseAdmin } from "@/server/supabase/admin";

type AuditPayload = {
  applicationId: string;
  stageType: "ATS" | "MCQ" | "CODING" | "INTERVIEW";
  status: "SUCCESS" | "FAILED" | "BLOCKED";
  actorUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  detail?: Record<string, unknown>;
};

export async function logStageSubmission(payload: AuditPayload) {
  try {
    const admin = createSupabaseAdmin();
    await admin.from("stage_submission_audit_logs").insert({
      application_id: payload.applicationId,
      stage_type: payload.stageType,
      status: payload.status,
      actor_user_id: payload.actorUserId || null,
      ip_address: payload.ipAddress || null,
      user_agent: payload.userAgent || null,
      detail: payload.detail || {},
    });
  } catch (error) {
    console.error("logStageSubmission:", error);
  }
}
