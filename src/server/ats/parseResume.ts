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
    const legacyParser =
      (pdfModule as unknown as { default?: (input: Buffer) => Promise<{ text?: string }> }).default ??
      (pdfModule as unknown as ((input: Buffer) => Promise<{ text?: string }>) | Record<string, never>);

    if (typeof legacyParser === "function") {
      const parsed = await legacyParser(bytes);
      return normalizeText(parsed.text || "");
    }

    const ModernPdfParse = (pdfModule as unknown as { PDFParse?: new (opts: { data: Buffer }) => { getText: () => Promise<{ text?: string }>; destroy?: () => Promise<void> | void } }).PDFParse;
    if (!ModernPdfParse) {
      throw new Error("Unable to parse PDF resume: unsupported pdf-parse module shape.");
    }

    const parser = new ModernPdfParse({ data: bytes });
    const parsed = await parser.getText();
    await parser.destroy?.();
    return normalizeText(parsed.text || "");
  }

  if (mimeType.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) {
    return normalizeText(bytes.toString("utf-8"));
  }

  throw new Error("Unsupported resume file type. Please upload PDF or TXT.");
}
