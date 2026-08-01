import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

function normalizeFileName(name, fallback = "document.pdf") {
  const raw = String(name || fallback).trim() || fallback;
  return raw.toLowerCase().endsWith(".pdf")
    ? raw
    : `${raw.replace(/\.(html?|htm)$/i, "")}.pdf`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FileReader fail"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Render HTML in a hidden iframe → wait for layout/images.
 * Shared by PDF download + folder save.
 */
async function withRenderedHtml(html, fn) {
  const fullHtml = extractRenderableHtml(html);
  if (!fullHtml) {
    throw new Error("PDF ke liye HTML missing hai.");
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-12000px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  try {
    const docWin = iframe.contentWindow;
    const docEl = iframe.contentDocument;
    if (!docWin || !docEl) {
      throw new Error("PDF preview frame open nahi hua.");
    }

    docEl.open();
    docEl.write(fullHtml);
    docEl.close();

    await new Promise((resolve) => {
      if (docEl.readyState === "complete") {
        window.setTimeout(resolve, 80);
        return;
      }
      iframe.onload = () => window.setTimeout(resolve, 80);
    });

    const images = Array.from(docEl.images || []);
    await Promise.all(
      images.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.onload = () => res();
                img.onerror = () => res();
                window.setTimeout(res, 2000);
              }),
      ),
    );

    const target = docEl.body || docEl.documentElement;
    if (!target) {
      throw new Error("PDF body nahi mila.");
    }

    return await fn({ docEl, target });
  } finally {
    iframe.remove();
  }
}

/** data:text/html URL → HTML string */
export function htmlFromDataUrl(dataUrl) {
  const raw = String(dataUrl || "");
  if (!raw.startsWith("data:")) return raw;
  const comma = raw.indexOf(",");
  if (comma < 0) return "";
  const meta = raw.slice(0, comma);
  const payload = raw.slice(comma + 1);
  try {
    if (/;base64/i.test(meta)) {
      return decodeURIComponent(escape(atob(payload)));
    }
    return decodeURIComponent(payload);
  } catch {
    try {
      return decodeURIComponent(payload);
    } catch {
      return payload;
    }
  }
}

function extractRenderableHtml(html) {
  const text = String(html || "").trim();
  if (!text) return "";
  /* Full document — keep styles via srcdoc in iframe */
  if (/<!doctype|<html[\s>]/i.test(text)) return text;
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>${text}</body></html>`;
}

/** HTML → PDF data URL (customer folder save; no download). */
export async function renderHtmlToPdfDataUrl(html) {
  return withRenderedHtml(html, async ({ target }) => {
    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });

    await pdf.html(target, {
      margin: [6, 6, 6, 6],
      autoPaging: "text",
      width: 198,
      windowWidth: 794,
      html2canvas: {
        scale: 1.25,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      },
    });

    const blob = pdf.output("blob");
    const dataUrl = await blobToDataUrl(blob);
    return { dataUrl, blob, mimeType: "application/pdf" };
  });
}

/** HTML → JPG data URL (customer folder preview). */
export async function renderHtmlToJpegDataUrl(html, { quality = 0.82 } = {}) {
  return withRenderedHtml(html, async ({ target }) => {
    const canvas = await html2canvas(target, {
      scale: 1.2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl, mimeType: "image/jpeg" };
  });
}

/**
 * Invoice / Quotation HTML → A4 PDF download (jsPDF + html2canvas).
 */
export async function downloadHtmlAsPdf(html, fileName = "document.pdf") {
  const { blob } = await renderHtmlToPdfDataUrl(html);
  const name = normalizeFileName(fileName);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { ok: true, fileName: name };
}

/** Stored customer document (HTML) → PDF download. Agar pehle se PDF hai to seedha download. */
export async function downloadDocumentAsPdf(doc, fileNameHint) {
  if (!doc?.dataUrl) {
    throw new Error("Document missing.");
  }
  const mime = String(doc.mimeType || "").toLowerCase();
  const name = String(doc.fileName || fileNameHint || "document");

  if (mime.includes("pdf") || name.toLowerCase().endsWith(".pdf")) {
    const { downloadStoredDocument } = await import("./customerDocuments");
    downloadStoredDocument(doc);
    return { ok: true, fileName: name };
  }

  const html = htmlFromDataUrl(doc.dataUrl);
  return downloadHtmlAsPdf(html, fileNameHint || name);
}
