import { jsPDF } from "jspdf";
import {
  MONTH_NAMES,
  VENDOR_AGREEMENT_OVERLAYS,
  VENDOR_AGREEMENT_PAGES,
  VENDOR_PRINT_FONT,
} from "../constants/vendorAgreement";
import {
  addCustomerDocument,
  listCustomerDocuments,
  removeCustomerDocument,
} from "./customerDocuments";

const PRINT_FONT = `"Times New Roman", Times, serif`;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Vendor agreement page load fail: ${src}`));
    img.src = src;
  });
}

function parseAgreementDate(dateStr) {
  const raw = String(dateStr || "").trim();
  // Avoid regex character-class hyphen bugs — normalize then split
  const parts = raw.replace(/[./]/g, "-").split("-").filter(Boolean);
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (String(parts[2]).length === 2) y += 2000;
    if (d > 0 && m >= 1 && m <= 12 && y > 1900) {
      const yy = String(y).slice(-2);
      const dd = String(d).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      return {
        day: dd,
        month: MONTH_NAMES[m - 1],
        monthNum: mm,
        year: String(y),
        yearShort: yy,
        short: `${dd}  ${mm}  ${yy}`,
        display: `${dd}-${mm}-${y}`,
      };
    }
  }
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const y = now.getFullYear();
  const yy = String(y).slice(-2);
  return {
    day: dd,
    month: MONTH_NAMES[now.getMonth()],
    monthNum: mm,
    year: String(y),
    yearShort: yy,
    short: `${dd}  ${mm}  ${yy}`,
    display: `${dd}-${mm}-${y}`,
  };
}

/** Name S/O or W/O relative — uppercase like vendor printed lines. */
export function formatVendorPartyName(customerName, fatherName, relation = "S/O") {
  const name = String(customerName || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  const father = String(fatherName || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  if (!name) return "";
  if (!father) return name;
  const rel = String(relation || "S/O")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const connector = rel === "W/O" || rel === "WO" ? "W/O" : rel === "D/O" || rel === "DO" ? "D/O" : "S/O";
  return `${name} ${connector} ${father}`;
}

export function formatVendorPartyAddress(address) {
  return String(address || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/,+/g, ",")
    .toUpperCase();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const trial = `${current} ${words[i]}`;
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Consumer text on dotted rows — same size as vendor print.
 * Use spec.bold for date (Day / Month / Year).
 */
function drawOnDottedLine(ctx, text, spec, imgW, imgH) {
  const value = String(text || "").trim();
  if (!value) return;

  const x = spec.x * imgW;
  const y = spec.y * imgH;
  const maxW = (spec.maxW || 0.4) * imgW;
  const fontFrac = spec.font || VENDOR_PRINT_FONT;
  const fontPx = Math.max(9, fontFrac * imgH);
  const weight = spec.bold ? "bold " : "";

  ctx.save();
  ctx.font = `${weight}${fontPx}px ${PRINT_FONT}`;
  ctx.textBaseline = "alphabetic";

  const lines = wrapText(ctx, value, maxW);
  const lineH = fontPx * 1.15;

  lines.forEach((line, i) => {
    const ly = y + i * lineH;
    const tw = Math.min(ctx.measureText(line).width, maxW);

    // Cover only dots under glyphs
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 0.5, ly - fontPx * 0.78, tw + 1, fontPx * 0.92);

    ctx.fillStyle = "#000000";
    ctx.fillText(line, x, ly);

    if (spec.underline !== false) {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = Math.max(0.8, fontPx * 0.06);
      ctx.beginPath();
      ctx.moveTo(x, ly + 1.5);
      ctx.lineTo(x + tw, ly + 1.5);
      ctx.stroke();
    }
  });
  ctx.restore();
}

async function composePageDataUrl(pageIndex, party) {
  const img = await loadImage(VENDOR_AGREEMENT_PAGES[pageIndex]);
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = imgW;
  canvas.height = imgH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  if (pageIndex === 0) {
    const o = VENDOR_AGREEMENT_OVERLAYS.page1;
    drawOnDottedLine(ctx, party.day, o.day, imgW, imgH);
    drawOnDottedLine(ctx, party.month, o.month, imgW, imgH);
    drawOnDottedLine(ctx, party.year, o.year, imgW, imgH);
    drawOnDottedLine(ctx, party.fullName, o.name, imgW, imgH);
    drawOnDottedLine(ctx, party.address, o.address, imgW, imgH);
  }

  if (pageIndex === 3) {
    const o = VENDOR_AGREEMENT_OVERLAYS.page4;
    drawOnDottedLine(ctx, party.fullName, o.name, imgW, imgH);
    drawOnDottedLine(ctx, party.address, o.address, imgW, imgH);
    drawOnDottedLine(ctx, party.dateDisplay, o.date, imgW, imgH);
  }

  return canvas.toDataURL("image/jpeg", 0.93);
}

/**
 * Same scanned Vendor Agreement PDF — consumer details on dotted lines only.
 */
export async function generateVendorAgreementPdf(row) {
  const fullName = formatVendorPartyName(
    row?.customerName,
    row?.fatherName,
    row?.nameRelation || row?.relation || "S/O",
  );
  const address = formatVendorPartyAddress(row?.address);
  const consumerNo = String(row?.consumerNo || "").trim();
  const customerName = String(row?.customerName || "").trim();

  if (!customerName) {
    throw new Error("Customer Name fill karein — dotted line (Name of Consumer) ke liye.");
  }
  if (!String(row?.fatherName || "").trim()) {
    throw new Error("Father/Husband Name fill karein — S/O ya W/O format ke liye.");
  }
  if (!address) {
    throw new Error("Address fill karein — 'having address at ........' line ke liye.");
  }

  const when = parseAgreementDate(row?.date);
  const party = {
    fullName,
    address,
    day: when.day,
    month: when.monthNum,
    year: when.yearShort,
    dateDisplay: when.display,
  };

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  for (let i = 0; i < VENDOR_AGREEMENT_PAGES.length; i += 1) {
    if (i > 0) doc.addPage();
    const pageData = await composePageDataUrl(i, party);
    doc.addImage(pageData, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
  }

  const safeName =
    customerName
      .toUpperCase()
      .replace(/[^\w]+/g, "_")
      .slice(0, 24) || "customer";
  const fileName = `Vendor-Agreement-${consumerNo || safeName}-${when.display}.pdf`;
  const blob = doc.output("blob");
  const dataUrl = doc.output("datauristring");

  return {
    blob,
    dataUrl,
    fileName,
    consumerNo,
    customerName: fullName,
    address,
  };
}

export function downloadVendorAgreementPdf({ blob, fileName }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "Vendor-Agreement.pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function saveVendorAgreementToFolder(result) {
  if (!result?.consumerNo || !result?.dataUrl) return null;
  const fileName = result.fileName;
  const existing = listCustomerDocuments(result.consumerNo, { source: "loan" })
    .concat(listCustomerDocuments(result.consumerNo, { source: "cash" }))
    .concat(listCustomerDocuments(result.consumerNo, { source: "sale" }));
  existing
    .filter((d) => d.category === "vendor-agreement")
    .forEach((d) => removeCustomerDocument(d.id));

  try {
    return await addCustomerDocument({
      consumerNo: result.consumerNo,
      source: "sale",
      category: "vendor-agreement",
      fileName,
      mimeType: "application/pdf",
      dataUrl: result.dataUrl,
      subfolder: "VendorAgreement",
    });
  } catch {
    return null;
  }
}
