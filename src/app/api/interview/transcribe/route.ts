import { NextResponse } from "next/server";
import { requireAuthUser } from "@/server/auth/session";

export async function POST(request: Request) {
  try {
    await requireAuthUser();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is required for transcription." }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("audio") as File | null;
    if (!file) {
      return NextResponse.json({ error: "audio file is required." }, { status: 400 });
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("model", "whisper-1");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: fd,
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: "Transcription failed.", detail: errText }, { status: 502 });
    }

    const json = (await res.json()) as { text?: string };
    return NextResponse.json({ text: json.text || "" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
