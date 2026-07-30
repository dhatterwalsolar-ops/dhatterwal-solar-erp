import { DEFAULT_INVOICE_FORMAT } from "../constants/companyInvoice";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

const KEY = "dhatterwal_erp_settings";
const MAX_LOGO_BYTES = 1.5 * 1024 * 1024;

function read() {
  try {
    const raw = erpGetItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    erpSetItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function normalizeBanks(banks) {
  const list = Array.isArray(banks) && banks.length ? banks : DEFAULT_INVOICE_FORMAT.banks;
  return list.slice(0, 4).map((b) => ({
    name: b?.name || "",
    accountNo: b?.accountNo || "",
    ifsc: b?.ifsc || "",
    branch: b?.branch || "",
  }));
}

function normalizeTerms(terms) {
  if (Array.isArray(terms) && terms.length) return terms.map((t) => String(t || ""));
  return [...DEFAULT_INVOICE_FORMAT.terms];
}

/** Merged invoice stationery (Settings → Invoice Format). */
export function getInvoiceFormat() {
  const saved = read().invoiceFormat || {};
  return {
    ...DEFAULT_INVOICE_FORMAT,
    ...saved,
    banks: normalizeBanks(saved.banks ?? DEFAULT_INVOICE_FORMAT.banks),
    terms: normalizeTerms(saved.terms ?? DEFAULT_INVOICE_FORMAT.terms),
    solarSharePercent: Number(saved.solarSharePercent ?? DEFAULT_INVOICE_FORMAT.solarSharePercent),
    solarGstPercent: Number(saved.solarGstPercent ?? DEFAULT_INVOICE_FORMAT.solarGstPercent),
    installGstPercent: Number(saved.installGstPercent ?? DEFAULT_INVOICE_FORMAT.installGstPercent),
  };
}

export function saveInvoiceFormat(format) {
  const saved = read();
  const next = {
    ...DEFAULT_INVOICE_FORMAT,
    ...format,
    banks: normalizeBanks(format.banks),
    terms: normalizeTerms(format.terms),
    solarSharePercent: Number(format.solarSharePercent ?? DEFAULT_INVOICE_FORMAT.solarSharePercent),
    solarGstPercent: Number(format.solarGstPercent ?? DEFAULT_INVOICE_FORMAT.solarGstPercent),
    installGstPercent: Number(format.installGstPercent ?? DEFAULT_INVOICE_FORMAT.installGstPercent),
    logoDataUrl: format.logoDataUrl || "",
    signDataUrl: format.signDataUrl || "",
  };
  const ok = write({ ...saved, invoiceFormat: next });
  if (ok && typeof window !== "undefined") {
    window.dispatchEvent(new Event("dhatterwal-invoice-format-sync"));
  }
  return ok;
}

export function resetInvoiceFormat() {
  const saved = read();
  const { invoiceFormat: _removed, ...rest } = saved;
  write(rest);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dhatterwal-invoice-format-sync"));
  }
  return getInvoiceFormat();
}

export function readFileAsDataUrlLimited(file, maxBytes = MAX_LOGO_BYTES) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file"));
      return;
    }
    if (file.size > maxBytes) {
      reject(
        new Error(
          `Image max ${(maxBytes / (1024 * 1024)).toFixed(1)} MB tak allow hai (browser storage).`,
        ),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

export { MAX_LOGO_BYTES };
