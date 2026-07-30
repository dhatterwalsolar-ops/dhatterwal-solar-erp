import { PAYMENT_MODES } from "../constants/paymentManagement";
import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

const STORAGE_KEY = "dhatterwal_payment_accounts";

export const PAYMENT_ACCOUNTS_SYNC_EVENT = "dhatterwal-payment-accounts-sync";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function defaultAccounts() {
  return PAYMENT_MODES.map((name, index) => ({
    id: `acc-default-${index}`,
    name,
    currentBalance: 0,
  }));
}

export function loadPaymentAccounts() {
  const stored = safeParse(erpGetItem(STORAGE_KEY), null);
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.map((a) => ({
      id: a.id || `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: String(a.name || "").trim() || "Account",
      currentBalance: Number(a.currentBalance) || 0,
    }));
  }
  return defaultAccounts();
}

export function savePaymentAccounts(accounts) {
  const cleaned = accounts.map((a) => ({
    id: a.id,
    name: String(a.name || "").trim(),
    currentBalance: Number(a.currentBalance) || 0,
  }));
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

export function getOpeningBalanceForMode(mode) {
  const name = String(mode || "").trim();
  const acc = loadPaymentAccounts().find((a) => a.name === name);
  return acc ? Number(acc.currentBalance) || 0 : 0;
}

export function createEmptyPaymentAccount() {
  return {
    id: `acc-${Date.now()}`,
    name: "",
    currentBalance: 0,
  };
}
