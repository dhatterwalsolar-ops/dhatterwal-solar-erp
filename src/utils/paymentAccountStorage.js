import { PAYMENT_MODES } from "../constants/paymentManagement";
import { erpGetItem, erpSetItem } from "./erpStorage";

const STORAGE_KEY = "dhatterwal_payment_accounts";

export const PAYMENT_ACCOUNTS_SYNC_EVENT = "dhatterwal-payment-accounts-sync";

/** Saving / Current = cash-like balance. Limit / Credit Limit = OD / credit card style. */
export const ACCOUNT_TYPES = ["Saving", "Current", "Limit", "Credit Limit"];

export function isLimitAccountType(accountType) {
  const t = String(accountType || "").trim();
  return t === "Limit" || t === "Credit Limit";
}

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeAccount(a, index = 0) {
  const accountType = ACCOUNT_TYPES.includes(a?.accountType) ? a.accountType : "Saving";
  const limitType = isLimitAccountType(accountType);
  return {
    id: a?.id || `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${index}`,
    name: String(a?.name || "").trim() || "Account",
    accountType,
    currentBalance: Number(a?.currentBalance) || 0,
    totalLimit: limitType ? Math.max(0, Number(a?.totalLimit) || 0) : 0,
    usedPayment: limitType ? Math.max(0, Number(a?.usedPayment) || 0) : 0,
  };
}

function defaultAccounts() {
  return PAYMENT_MODES.map((name, index) =>
    normalizeAccount(
      {
        id: `acc-default-${index}`,
        name,
        accountType: name.toLowerCase().includes("cash") ? "Saving" : "Current",
        currentBalance: 0,
        totalLimit: 0,
        usedPayment: 0,
      },
      index,
    ),
  );
}

export function loadPaymentAccounts() {
  const stored = safeParse(erpGetItem(STORAGE_KEY), null);
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.map((a, index) => normalizeAccount(a, index));
  }
  return defaultAccounts();
}

export function savePaymentAccounts(accounts) {
  const cleaned = accounts.map((a, index) => normalizeAccount(a, index)).filter((a) => a.name);
  try {
    erpSetItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(PAYMENT_ACCOUNTS_SYNC_EVENT));
}

export function getPaymentModeNames() {
  const names = loadPaymentAccounts().map((a) => a.name).filter(Boolean);
  return names.length > 0 ? names : [...PAYMENT_MODES];
}

export function getPaymentAccountByName(mode) {
  const name = String(mode || "").trim();
  return loadPaymentAccounts().find((a) => a.name === name) || null;
}

export function getOpeningBalanceForMode(mode) {
  const acc = getPaymentAccountByName(mode);
  if (!acc) return 0;
  if (isLimitAccountType(acc.accountType)) return 0;
  return Number(acc.currentBalance) || 0;
}

export function createEmptyPaymentAccount() {
  return normalizeAccount({
    id: `acc-${Date.now()}`,
    name: "",
    accountType: "Saving",
    currentBalance: 0,
    totalLimit: 0,
    usedPayment: 0,
  });
}
