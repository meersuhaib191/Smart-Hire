import { NextResponse } from "next/server";

/** Legacy endpoint: MCQs are generated per candidate via POST /api/mcq/start and `src/services/testEngine.ts`. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint is retired. MCQ tests are built dynamically when a candidate starts the MCQ round (see POST /api/mcq/start).",
    },
    { status: 410 }
  );
}
