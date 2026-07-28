import {
  DEFAULT_ERP_USERS,
  DEFAULT_INVOICE_SERIES,
  DEFAULT_QUOTATION_SERIES,
} from "../constants/settingsDefaults";

const KEY = "dhatterwal_erp_settings";

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getSettingsState() {
  const saved = read();
  return {
    users: saved.users ?? DEFAULT_ERP_USERS.map((u) => ({ ...u })),
    invoiceSeries: { ...DEFAULT_INVOICE_SERIES, ...saved.invoiceSeries },
    quotationSeries: { ...DEFAULT_QUOTATION_SERIES, ...saved.quotationSeries },
  };
}

export function saveInvoiceSeries(series) {
  const saved = read();
  write({ ...saved, invoiceSeries: series });
}

export function saveQuotationSeries(series) {
  const saved = read();
  write({ ...saved, quotationSeries: series });
}

export function saveUsers(users) {
  const saved = read();
  write({ ...saved, users });
}

export function appendActivityLog(entry) {
  const saved = read();
  const log = saved.activityLog ?? [];
  write({
    ...saved,
    activityLog: [{ ...entry, at: new Date().toISOString() }, ...log].slice(0, 50),
  });
}

export function getActivityLog() {
  const saved = read();
  return saved.activityLog ?? [];
}
