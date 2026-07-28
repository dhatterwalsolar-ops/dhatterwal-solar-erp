/** Extract likely panel/inverter serial lines from OCR or pasted text */
export function parseSerialNumbersFromText(text) {
  const raw = String(text || "");
  const lines = raw
    .split(/[\n,;|]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const pattern =
    /\b([A-Z]{2,}(?:[-/][A-Z0-9]{1,}){1,4}[-/]?\d{4,6}|\d{10,15}|[A-Z]{2,}\d{5,}[A-Z0-9-]*)\b/gi;

  const found = new Set();
  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, " ").trim();
    if (cleaned.length >= 6 && cleaned.length <= 40) {
      found.add(cleaned.toUpperCase());
    }
    let match;
    const linePattern = new RegExp(pattern.source, pattern.flags);
    while ((match = linePattern.exec(line)) !== null) {
      found.add(match[1].toUpperCase());
    }
  }

  return [...found];
}

export async function extractSerialsFromImageFile(file) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    const serials = parseSerialNumbersFromText(text);
    return { text, serials };
  } finally {
    await worker.terminate();
  }
}
