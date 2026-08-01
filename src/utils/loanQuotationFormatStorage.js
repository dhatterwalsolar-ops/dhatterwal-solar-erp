import { DEFAULT_LOAN_QUOTATION_FORMAT } from "../constants/companyInvoice";
import { readFileAsDataUrlLimited, MAX_LOGO_BYTES } from "./invoiceFormatStorage";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

const KEY = "dhatterwal_erp_settings";

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
  const list =
    Array.isArray(banks) && banks.length ? banks : DEFAULT_LOAN_QUOTATION_FORMAT.banks;
  return list.slice(0, 4).map((b) => ({
    name: b?.name || "",
    accountNo: b?.accountNo || "",
    ifsc: b?.ifsc || "",
    branch: b?.branch || "",
  }));
}

function normalizeTerms(terms) {
  if (Array.isArray(terms) && terms.length) return terms.map((t) => String(t || ""));
  return [...DEFAULT_LOAN_QUOTATION_FORMAT.terms];
}

function normalizeInstallDetailLines(lines) {
  if (Array.isArray(lines) && lines.length) {
    return lines.map((t) => String(t || ""));
  }
  return [...(DEFAULT_LOAN_QUOTATION_FORMAT.installDetailLines || [])];
}

function normalizeSignatoryFor(value) {
  const raw = String(value || "").trim();
  if (!raw || /^for\s+dhatterwal\s+solar\s+energy\s+system$/i.test(raw)) {
    return DEFAULT_LOAN_QUOTATION_FORMAT.signatoryFor;
  }
  return raw;
}

export function getLoanQuotationFormat() {
  const saved = read().loanQuotationFormat || {};
  return {
    ...DEFAULT_LOAN_QUOTATION_FORMAT,
    ...saved,
    signatoryFor: normalizeSignatoryFor(
      saved.signatoryFor ?? DEFAULT_LOAN_QUOTATION_FORMAT.signatoryFor,
    ),
    banks: normalizeBanks(saved.banks ?? DEFAULT_LOAN_QUOTATION_FORMAT.banks),
    terms: normalizeTerms(saved.terms ?? DEFAULT_LOAN_QUOTATION_FORMAT.terms),
    installDetailLines: normalizeInstallDetailLines(
      saved.installDetailLines ?? DEFAULT_LOAN_QUOTATION_FORMAT.installDetailLines,
    ),
    panelDetailLabel:
      saved.panelDetailLabel ?? DEFAULT_LOAN_QUOTATION_FORMAT.panelDetailLabel,
    inverterDetailLabel:
      saved.inverterDetailLabel ?? DEFAULT_LOAN_QUOTATION_FORMAT.inverterDetailLabel,
    solarSharePercent: Number(
      saved.solarSharePercent ?? DEFAULT_LOAN_QUOTATION_FORMAT.solarSharePercent,
    ),
    solarGstPercent: Number(
      saved.solarGstPercent ?? DEFAULT_LOAN_QUOTATION_FORMAT.solarGstPercent,
    ),
    installGstPercent: Number(
      saved.installGstPercent ?? DEFAULT_LOAN_QUOTATION_FORMAT.installGstPercent,
    ),
  };
}

export function saveLoanQuotationFormat(format) {
  const saved = read();
  const next = {
    ...DEFAULT_LOAN_QUOTATION_FORMAT,
    ...format,
    banks: normalizeBanks(format.banks),
    terms: normalizeTerms(format.terms),
    installDetailLines: normalizeInstallDetailLines(format.installDetailLines),
    panelDetailLabel:
      format.panelDetailLabel || DEFAULT_LOAN_QUOTATION_FORMAT.panelDetailLabel,
    inverterDetailLabel:
      format.inverterDetailLabel || DEFAULT_LOAN_QUOTATION_FORMAT.inverterDetailLabel,
    solarSharePercent: Number(
      format.solarSharePercent ?? DEFAULT_LOAN_QUOTATION_FORMAT.solarSharePercent,
    ),
    solarGstPercent: Number(
      format.solarGstPercent ?? DEFAULT_LOAN_QUOTATION_FORMAT.solarGstPercent,
    ),
    installGstPercent: Number(
      format.installGstPercent ?? DEFAULT_LOAN_QUOTATION_FORMAT.installGstPercent,
    ),
    logoDataUrl: format.logoDataUrl || "",
    signDataUrl: format.signDataUrl || "",
  };
  const ok = write({ ...saved, loanQuotationFormat: next });
  if (ok && typeof window !== "undefined") {
    window.dispatchEvent(new Event("dhatterwal-loan-quotation-format-sync"));
  }
  return ok;
}

export function resetLoanQuotationFormat() {
  const saved = read();
  const { loanQuotationFormat: _removed, ...rest } = saved;
  write(rest);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dhatterwal-loan-quotation-format-sync"));
  }
  return getLoanQuotationFormat();
}

export { readFileAsDataUrlLimited, MAX_LOGO_BYTES };
