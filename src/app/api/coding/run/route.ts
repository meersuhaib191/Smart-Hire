import { NextResponse } from "next/server";
import { executeWithJudge0 } from "@/server/coding/judge0";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sourceCode?: string;
      language?: string;
      stdin?: string;
    };

    const sourceCode = body.sourceCode || "";
    const language = body.language || "javascript";
    if (!sourceCode.trim()) {
      return NextResponse.json({ error: "sourceCode is required." }, { status: 400 });
    }

    const result = await executeWithJudge0({
      sourceCode,
      language,
      stdin: body.stdin || "",
    });

    return NextResponse.json({
      success: true,
      output: result.stdout || "",
      stderr: result.stderr || "",
      status: result.status?.description || "Unknown",
      runtime: result.time || null,
      memory: result.memory || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Code execution failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
