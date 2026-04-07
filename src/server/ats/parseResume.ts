const MAX_TEXT_LENGTH = 20000;

const normalizeText = (raw: string) =>
  raw
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);

export async function extractResumeText(file: File): Promise<string> {
  const mimeType = file.type || "";
  const bytes = Buffer.from(await file.arrayBuffer());

  if (mimeType.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfModule = await import("pdf-parse");
    const pdf = pdfModule.default;
    const parsed = await pdf(bytes);
    return normalizeText(parsed.text || "");
  }

  if (mimeType.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) {
    return normalizeText(bytes.toString("utf-8"));
  }

  throw new Error("Unsupported resume file type. Please upload PDF or TXT.");
}
