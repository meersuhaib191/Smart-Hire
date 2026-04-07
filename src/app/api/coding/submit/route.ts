import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { runAgainstTestCases } from "@/server/coding/judge0";
import { syncPipelineStep } from "@/server/pipeline/syncPipeline";

const CODING_PASS_SCORE = Number(process.env.CODING_PASS_SCORE || 60);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      applicationId?: string;
      challengeId?: string;
      sourceCode?: string;
      language?: string;
    };

    const applicationId = body.applicationId || "";
    const challengeId = body.challengeId || "";
    const sourceCode = body.sourceCode || "";
    const language = body.language || "javascript";

    if (!applicationId || !challengeId || !sourceCode.trim()) {
      return NextResponse.json(
        { error: "applicationId, challengeId and sourceCode are required." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();
    const { data: testCases, error: tcError } = await supabase
      .from("coding_test_cases")
      .select("input, expected_output, is_hidden")
      .eq("challenge_id", challengeId);

    if (tcError || !testCases?.length) {
      return NextResponse.json(
        { error: "No test cases found for challenge.", detail: tcError?.message },
        { status: 404 }
      );
    }

    const evalResult = await runAgainstTestCases({
      sourceCode,
      language,
      testCases: testCases as Array<{ input: string; expected_output: string; is_hidden: boolean }>,
    });

    const executionLog = evalResult.executions.map((e) => ({
      status: e.status?.description || "Unknown",
      passed: e.passed,
      isHidden: e.isHidden,
      runtime: e.time,
      memory: e.memory,
      stderr: e.stderr,
      compile_output: e.compile_output,
      expectedOutput: e.expectedOutput,
      actualOutput: e.actualOutput,
      input: e.input,
    }));

    const { error: subError } = await supabase.from("coding_submissions").insert({
      application_id: applicationId,
      challenge_id: challengeId,
      language,
      source_code: sourceCode,
      score: evalResult.score,
      passed_count: evalResult.passedCount,
      total_count: evalResult.totalCount,
      execution_log: executionLog,
    });
    if (subError) {
      return NextResponse.json({ error: "Failed to save submission.", detail: subError.message }, { status: 500 });
    }

    const { data: existingStage } = await supabase
      .from("stage_results")
      .select("id")
      .eq("application_id", applicationId)
      .eq("stage_type", "CODING")
      .maybeSingle();

    const stagePayload = {
      score: evalResult.score,
      breakdown: {
        passed_count: evalResult.passedCount,
        total_count: evalResult.totalCount,
      },
      passed: evalResult.score >= CODING_PASS_SCORE,
      evaluated_at: new Date().toISOString(),
    };

    if (existingStage?.id) {
      await supabase.from("stage_results").update(stagePayload).eq("id", existingStage.id);
    } else {
      await supabase.from("stage_results").insert({
        application_id: applicationId,
        stage_type: "CODING",
        ...stagePayload,
      });
    }

    try {
      await syncPipelineStep(applicationId);
    } catch (e) {
      console.error("syncPipelineStep (CODING):", e);
    }

    return NextResponse.json({
      success: true,
      result: {
        score: Number(evalResult.score.toFixed(2)),
        passedCount: evalResult.passedCount,
        totalCount: evalResult.totalCount,
        passed: evalResult.score >= CODING_PASS_SCORE,
        visibleResults: executionLog.filter((e) => !e.isHidden),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Coding submission failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
