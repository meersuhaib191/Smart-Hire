import { createSupabaseAdmin } from "@/server/supabase/admin";

const STAGES = ["ATS", "MCQ", "CODING", "INTERVIEW"] as const;

export async function syncPipelineStep(applicationId: string) {
  const admin = createSupabaseAdmin();
  const { data: stages, error } = await admin
    .from("stage_results")
    .select("stage_type, passed")
    .eq("application_id", applicationId);

  if (error) {
    console.error("syncPipelineStep:", error.message);
    return;
  }

  const passed = new Set(
    (stages || []).filter((s) => s.passed).map((s) => s.stage_type as string)
  );

  let pipelineStep: string = "COMPLETE";
  for (const stage of STAGES) {
    if (!passed.has(stage)) {
      pipelineStep = stage;
      break;
    }
  }

  let currentStage: string = "APPLIED";
  if (pipelineStep === "COMPLETE") currentStage = "OFFER";
  else if (pipelineStep === "INTERVIEW") currentStage = "INTERVIEW";
  else if (passed.has("ATS")) currentStage = "SCREENING";

  await admin
    .from("applications")
    .update({
      pipeline_step: pipelineStep,
      current_stage: currentStage,
    })
    .eq("id", applicationId);
}
