// src/utils/pdfTextExtractor.js
import fs from "fs";
import pdfParse from "pdf-parse";
import { execFile } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);

/**
 * Very small helper:
 * - If file ends with .pdf -> use pdf-parse
 * - If .docx/.doc -> try `docx2txt` or `antiword` if available (fallback: return empty string)
 *
 * For production use, prefer a robust library (mammoth for docx, textract, etc.)
 */
export async function extractTextFromFile(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const data = fs.readFileSync(filePath);
    const parsed = await pdfParse(data);
    return parsed.text || "";
  }

  if (lower.endsWith(".docx")) {
    // attempt to use `mammoth` if installed
    try {
      const mammoth = await import("mammoth");
      const buffer = fs.readFileSync(filePath);
      const { value } = await mammoth.extractRawText({ buffer });
      return value || "";
    } catch (err) {
      // fallback: try docx2txt (if present)
      try {
        const { stdout } = await execFileAsync("docx2txt", [filePath, "-"]);
        return stdout || "";
      } catch (e) {
        return "";
      }
    }
  }

  if (lower.endsWith(".doc")) {
    try {
      const { stdout } = await execFileAsync("antiword", [filePath]);
      return stdout || "";
    } catch (e) {
      return "";
    }
  }

  // Unknown type: attempt to read as text
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    return "";
  }
}
